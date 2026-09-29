import logging
from urllib.parse import quote

from django import forms
from django.conf import settings
from django.contrib import messages
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.encoding import force_str
from django.utils.http import url_has_allowed_host_and_scheme, urlsafe_base64_decode

from .emails import send_verification_email
from .tokens import email_verification_token

logger = logging.getLogger(__name__)
User = get_user_model()


class RegisterForm(UserCreationForm):
    email = forms.EmailField(
        required=True,
        label="Email address",
        widget=forms.EmailInput(attrs={"autocomplete": "email", "placeholder": "name@example.com"}),
    )

    class Meta(UserCreationForm.Meta):
        fields = ("username", "email")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field_name in ("username", "email", "password1", "password2"):
            if field_name in self.fields:
                self.fields[field_name].help_text = None

    def clean_email(self):
        email = self.cleaned_data.get("email", "").strip().lower()
        if not email:
            raise forms.ValidationError("Email address is required.")

        # Check for existing active account
        if User.objects.filter(email__iexact=email, is_active=True).exists():
            raise forms.ValidationError("An account with this email address already exists.")

        # Check for existing unverified account
        if User.objects.filter(email__iexact=email, is_active=False).exists():
            raise forms.ValidationError(
                "An unverified account with this email already exists. "
                "Please check your inbox or request a new verification link."
            )

        return email

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data["email"]
        user.is_active = False  # Account stays inactive until email is verified
        if commit:
            user.save()
        return user


class LoginForm(AuthenticationForm):
    """
    Subclasses Django's AuthenticationForm to provide explicit, helpful
    messaging if the user enters valid credentials for an unverified account.
    """
    def clean(self):
        username = self.cleaned_data.get("username")
        password = self.cleaned_data.get("password")

        if username is not None and password:
            self.user_cache = authenticate(
                self.request, username=username, password=password
            )
            if self.user_cache is None:
                # Check whether user credentials are valid but account is not activated
                try:
                    user = User.objects.get(**{User.USERNAME_FIELD: username})
                    if user.check_password(password) and not user.is_active:
                        raise forms.ValidationError(
                            "This account is not activated yet. Please check your email to verify your address, "
                            "or request a new verification link below.",
                            code="inactive",
                        )
                except User.DoesNotExist:
                    pass

                raise self.get_invalid_login_error()
            else:
                self.confirm_login_allowed(self.user_cache)

        return self.cleaned_data


class ResendVerificationForm(forms.Form):
    email = forms.EmailField(
        label="Email address",
        required=True,
        widget=forms.EmailInput(
            attrs={
                "class": "form-control",
                "placeholder": "name@example.com",
                "autocomplete": "email",
                "autofocus": True,
            }
        ),
    )


def register_view(request):
    raw_next = request.GET.get("next") or request.POST.get("next") or ""
    # Validate next url for security
    if raw_next and url_has_allowed_host_and_scheme(raw_next, allowed_hosts={request.get_host()}):
        next_url = raw_next
    else:
        next_url = "core:index"

    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            try:
                send_verification_email(request, user, next_url)
                messages.success(
                    request,
                    f"Registration successful! We sent a verification link to {user.email}.",
                )
            except Exception as exc:
                logger.error("Failed to send verification email to %s: %s", user.email, exc)
                messages.warning(
                    request,
                    "Your account was created, but we could not send the verification email right now. "
                    "Please use the resend verification option to receive your link.",
                )

            request.session["verification_email"] = user.email
            if next_url and next_url != "core:index":
                request.session["verification_next"] = next_url

            return redirect("accounts:verification_sent")
    else:
        form = RegisterForm()

    return render(request, "accounts/register.html", {"form": form, "next": next_url})


def verification_sent_view(request):
    email = request.session.get("verification_email", "")
    return render(request, "accounts/verification_sent.html", {"email": email})


def verify_email_view(request, uidb64, token):
    raw_next = request.GET.get("next", "")
    if raw_next and url_has_allowed_host_and_scheme(raw_next, allowed_hosts={request.get_host()}):
        next_param = raw_next
    else:
        next_param = ""

    user = None
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    login_url = reverse("accounts:login")
    if next_param:
        login_url += f"?next={quote(next_param)}"

    # Already active user clicking link again
    if user is not None and user.is_active:
        messages.info(request, "Your email is already verified. You can log in.")
        return redirect(login_url)

    # Valid inactive user and valid token
    if user is not None and email_verification_token.check_token(user, token):
        user.is_active = True
        user.save()
        messages.success(
            request,
            "Your email has been verified successfully! You can now log in to your account.",
        )
        return redirect(login_url)

    # Invalid, expired, or tampered token
    return render(
        request,
        "accounts/verification_invalid.html",
        {"resend_url": reverse("accounts:resend_verification")},
    )


def resend_verification_view(request):
    raw_next = request.GET.get("next") or request.POST.get("next") or ""
    if raw_next and url_has_allowed_host_and_scheme(raw_next, allowed_hosts={request.get_host()}):
        next_url = raw_next
    else:
        next_url = ""

    if request.method == "POST":
        form = ResendVerificationForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data["email"].strip().lower()
            user = User.objects.filter(email__iexact=email, is_active=False).first()
            if user:
                try:
                    send_verification_email(request, user, next_url)
                except Exception as exc:
                    logger.error("Failed to resend verification email to %s: %s", email, exc)

            # Prevent user enumeration: always display the same generic confirmation
            messages.info(
                request,
                "If an unverified account exists with that email address, a new verification link has been sent. "
                "Please check your inbox and spam folder.",
            )
            login_url = reverse("accounts:login")
            if next_url:
                login_url += f"?next={quote(next_url)}"
            return redirect(login_url)
    else:
        form = ResendVerificationForm()

    return render(request, "accounts/resend_verification.html", {"form": form, "next": next_url})

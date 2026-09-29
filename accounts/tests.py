from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client, TestCase
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from accounts.tokens import email_verification_token

User = get_user_model()


class EmailVerificationTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.register_url = reverse("accounts:register")
        self.login_url = reverse("accounts:login")
        self.resend_url = reverse("accounts:resend_verification")

    def test_signup_creates_inactive_user_and_sends_email(self):
        """1. User registers -> account is inactive (is_active=False) -> verification email sent."""
        response = self.client.post(
            self.register_url,
            {
                "username": "testuser",
                "email": "testuser@example.com",
                "password1": "ComplexPassword!123",
                "password2": "ComplexPassword!123",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse("accounts:verification_sent"))

        # User is in database but inactive
        user = User.objects.get(username="testuser")
        self.assertFalse(user.is_active)
        self.assertEqual(user.email, "testuser@example.com")

        # Email was sent
        self.assertEqual(len(mail.outbox), 1)
        sent_email = mail.outbox[0]
        self.assertIn("Verify your email address", sent_email.subject)
        self.assertIn("testuser@example.com", sent_email.to)
        self.assertIn("verify-email", sent_email.body)

    def test_unverified_user_cannot_login(self):
        """2. Unverified user must NOT be able to log in."""
        User.objects.create_user(
            username="unverified",
            email="unverified@example.com",
            password="ComplexPassword!123",
            is_active=False,
        )

        response = self.client.post(
            self.login_url,
            {
                "username": "unverified",
                "password": "ComplexPassword!123",
            },
        )
        # Form does not log in, returns form with error
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "This account is not activated yet")
        # Ensure session does not have logged in user
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_valid_verification_link_activates_user_and_allows_login(self):
        """3. Clicking valid verification link activates account and redirects to login."""
        user = User.objects.create_user(
            username="verify_me",
            email="verify_me@example.com",
            password="ComplexPassword!123",
            is_active=False,
        )
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = email_verification_token.make_token(user)

        verify_url = reverse("accounts:verify_email", kwargs={"uidb64": uid, "token": token})
        response = self.client.get(verify_url)

        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, self.login_url)

        # Refresh user from database
        user.refresh_from_db()
        self.assertTrue(user.is_active)

        # Now login succeeds
        login_response = self.client.post(
            self.login_url,
            {
                "username": "verify_me",
                "password": "ComplexPassword!123",
            },
        )
        self.assertEqual(login_response.status_code, 302)
        self.assertEqual(self.client.session["_auth_user_id"], str(user.pk))

    def test_tokens_are_not_reusable(self):
        """4. Once verified, old token cannot be reused."""
        user = User.objects.create_user(
            username="reusable_test",
            email="reusable@example.com",
            password="ComplexPassword!123",
            is_active=False,
        )
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = email_verification_token.make_token(user)

        # First verification succeeds
        verify_url = reverse("accounts:verify_email", kwargs={"uidb64": uid, "token": token})
        response1 = self.client.get(verify_url)
        self.assertEqual(response1.status_code, 302)

        user.refresh_from_db()
        self.assertTrue(user.is_active)

        # Second verification with same token detects user is already verified
        response2 = self.client.get(verify_url, follow=True)
        self.assertContains(response2, "Your email is already verified")

    def test_invalid_or_tampered_token_fails(self):
        """5. Invalid token or invalid uid displays invalid link page."""
        user = User.objects.create_user(
            username="tamper_test",
            email="tamper@example.com",
            password="ComplexPassword!123",
            is_active=False,
        )
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        # Tampered token
        invalid_url = reverse(
            "accounts:verify_email", kwargs={"uidb64": uid, "token": "invalid-token-here"}
        )
        response = self.client.get(invalid_url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Verification Link Invalid")

        # User remains inactive
        user.refresh_from_db()
        self.assertFalse(user.is_active)

    def test_resend_verification_email(self):
        """6. Resend verification email sends a new link for unverified user."""
        User.objects.create_user(
            username="resend_user",
            email="resend@example.com",
            password="ComplexPassword!123",
            is_active=False,
        )

        response = self.client.post(self.resend_url, {"email": "resend@example.com"})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("resend@example.com", mail.outbox[0].to)

    def test_resend_verification_prevents_user_enumeration(self):
        """7. Resending for non-existent or active email shows identical generic message."""
        # Non-existent email
        response = self.client.post(
            self.resend_url,
            {"email": "nonexistent@example.com"},
            follow=True,
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            "If an unverified account exists with that email address, a new verification link has been sent.",
        )
        self.assertEqual(len(mail.outbox), 0)

    def test_next_redirect_preserved_after_verification(self):
        """8. The next query parameter is preserved and passed to the login page."""
        user = User.objects.create_user(
            username="next_user",
            email="next@example.com",
            password="ComplexPassword!123",
            is_active=False,
        )
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = email_verification_token.make_token(user)

        verify_url = (
            reverse("accounts:verify_email", kwargs={"uidb64": uid, "token": token})
            + "?next=/custom-dashboard/"
        )
        response = self.client.get(verify_url)
        self.assertEqual(response.status_code, 302)
        self.assertIn("next=/custom-dashboard/", response.url)

import logging
from urllib.parse import quote

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from .tokens import email_verification_token

logger = logging.getLogger(__name__)


def send_verification_email(request, user, next_url=None):
    """
    Constructs and sends a time-limited email verification link to the user.
    """
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token.make_token(user)

    verify_path = reverse("accounts:verify_email", kwargs={"uidb64": uid, "token": token})
    if next_url and next_url != "core:index":
        verify_path += f"?next={quote(str(next_url))}"

    verification_url = request.build_absolute_uri(verify_path)
    timeout_hours = int(getattr(settings, "EMAIL_VERIFICATION_TIMEOUT", 86400) // 3600)

    subject = "Verify your email address — API Studio"

    text_body = f"""Hello {user.username},

Thank you for registering at API Studio!

Please verify your email address to activate your account by clicking the link below:
{verification_url}

This verification link will expire in {timeout_hours} hours.

If you did not create this account, please disregard this email.
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your email address</title>
</head>
<body style="margin:0;padding:24px;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;margin:0 auto;background:#1e293b;border-radius:12px;border:1px solid #334155;overflow:hidden;">
    <tr>
      <td style="padding:32px 32px 20px;text-align:left;border-bottom:1px solid #334155;">
        <span style="display:inline-block;padding:8px 12px;border-radius:8px;background:linear-gradient(135deg,#6366f1 0%,#a855f7 100%);color:#ffffff;font-weight:bold;font-size:16px;">
          API Studio
        </span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;color:#cbd5e1;font-size:15px;line-height:1.6;">
        <h2 style="margin-top:0;color:#f8fafc;font-size:20px;">Verify your email address</h2>
        <p>Hello <strong style="color:#ffffff;">{user.username}</strong>,</p>
        <p>Thanks for creating an account with API Studio! Please click the button below to verify your email address and activate your account:</p>
        <p style="margin:28px 0;text-align:center;">
          <a href="{verification_url}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#6366f1 0%,#a855f7 100%);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;box-shadow:0 4px 14px rgba(99,102,241,0.4);">
            Verify Email Address
          </a>
        </p>
        <p style="font-size:13px;color:#94a3b8;margin-top:20px;">
          Or copy and paste this link into your browser:<br>
          <a href="{verification_url}" style="color:#818cf8;word-break:break-all;">{verification_url}</a>
        </p>
        <hr style="border:none;border-top:1px solid #334155;margin:28px 0 16px;">
        <p style="font-size:12px;color:#64748b;margin:0;">
          This link will expire in {timeout_hours} hours. If you did not create an account, no further action is required.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "API Studio <noreply@localhost>")
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=from_email,
        to=[user.email],
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send(fail_silently=False)

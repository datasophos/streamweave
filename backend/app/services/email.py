"""Async email service using aiosmtplib."""

from __future__ import annotations

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str | list[str], subject: str, html_body: str) -> None:
    """Send an email. No-ops silently if smtp_enabled is False."""
    if not settings.smtp_enabled:
        logger.debug("SMTP disabled — skipping email to %s: %s", to, subject)
        return

    recipients = [to] if isinstance(to, str) else to

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = ", ".join(recipients)
    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username or None,
            password=settings.smtp_password or None,
            use_tls=settings.smtp_tls,
            start_tls=False,
        )
        logger.info("Email sent to %s: %s", recipients, subject)
    except Exception:
        logger.exception("Failed to send email to %s: %s", recipients, subject)
        raise

"""Tests for email service."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.email import send_email


@pytest.mark.asyncio
async def test_send_email_disabled_noop(monkeypatch):
    """Email is silently skipped when smtp_enabled=False."""
    monkeypatch.setattr("app.services.email.settings.smtp_enabled", False)

    with patch("app.services.email.aiosmtplib.send") as mock_send:
        await send_email("user@example.com", "Test", "<p>Hello</p>")
        mock_send.assert_not_called()


@pytest.mark.asyncio
async def test_send_email_enabled(monkeypatch):
    """Email is sent when smtp_enabled=True."""
    monkeypatch.setattr("app.services.email.settings.smtp_enabled", True)
    monkeypatch.setattr("app.services.email.settings.smtp_host", "localhost")
    monkeypatch.setattr("app.services.email.settings.smtp_port", 1025)
    monkeypatch.setattr("app.services.email.settings.smtp_tls", False)
    monkeypatch.setattr("app.services.email.settings.smtp_username", "")
    monkeypatch.setattr("app.services.email.settings.smtp_password", "")
    monkeypatch.setattr("app.services.email.settings.smtp_from", "noreply@streamweave.local")

    with patch("app.services.email.aiosmtplib.send", new_callable=AsyncMock) as mock_send:
        await send_email("user@example.com", "Subject", "<p>Body</p>")
        mock_send.assert_called_once()
        _, kwargs = mock_send.call_args
        assert kwargs["hostname"] == "localhost"
        assert kwargs["port"] == 1025


@pytest.mark.asyncio
async def test_send_email_multiple_recipients(monkeypatch):
    """List of recipients is forwarded correctly."""
    monkeypatch.setattr("app.services.email.settings.smtp_enabled", True)
    monkeypatch.setattr("app.services.email.settings.smtp_host", "localhost")
    monkeypatch.setattr("app.services.email.settings.smtp_port", 1025)
    monkeypatch.setattr("app.services.email.settings.smtp_tls", False)
    monkeypatch.setattr("app.services.email.settings.smtp_username", "")
    monkeypatch.setattr("app.services.email.settings.smtp_password", "")
    monkeypatch.setattr("app.services.email.settings.smtp_from", "noreply@streamweave.local")

    with patch("app.services.email.aiosmtplib.send", new_callable=AsyncMock) as mock_send:
        await send_email(["a@example.com", "b@example.com"], "Multi", "<p>Hi</p>")
        mock_send.assert_called_once()


@pytest.mark.asyncio
async def test_send_email_failure_raises(monkeypatch):
    """Exception from aiosmtplib is re-raised after logging."""
    monkeypatch.setattr("app.services.email.settings.smtp_enabled", True)
    monkeypatch.setattr("app.services.email.settings.smtp_host", "localhost")
    monkeypatch.setattr("app.services.email.settings.smtp_port", 1025)
    monkeypatch.setattr("app.services.email.settings.smtp_tls", False)
    monkeypatch.setattr("app.services.email.settings.smtp_username", "")
    monkeypatch.setattr("app.services.email.settings.smtp_password", "")
    monkeypatch.setattr("app.services.email.settings.smtp_from", "noreply@streamweave.local")

    with (
        patch(
            "app.services.email.aiosmtplib.send",
            new_callable=AsyncMock,
            side_effect=Exception("SMTP connection refused"),
        ),
        pytest.raises(Exception, match="SMTP connection refused"),
    ):
        await send_email("user@example.com", "Subject", "<p>Body</p>")

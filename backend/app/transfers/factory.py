"""Factory for creating transfer adapters from instrument configuration."""

from __future__ import annotations

from app.config import settings
from app.models.instrument import Instrument, TransferAdapterType
from app.services.credentials import decrypt_value
from app.transfers.base import TransferAdapter
from app.transfers.rclone import RcloneAdapter


def create_adapter(instrument: Instrument) -> TransferAdapter:
    """Create the appropriate transfer adapter for an instrument.

    The instrument must have its service_account relationship loaded.
    """
    if instrument.transfer_adapter != TransferAdapterType.rclone:
        raise NotImplementedError(
            f"Transfer adapter '{instrument.transfer_adapter}' not yet implemented"
        )

    sa = instrument.service_account
    if sa is None:
        raise ValueError(
            f"Instrument '{instrument.name}' has no service account configured"
        )

    password = decrypt_value(sa.password_encrypted)

    return RcloneAdapter(
        rclone_binary=settings.rclone_binary,
        smb_host=instrument.cifs_host,
        smb_share=instrument.cifs_share,
        smb_base_path=instrument.cifs_base_path or "/",
        smb_user=sa.username,
        smb_password=password,
        smb_domain=sa.domain or "WORKGROUP",
    )

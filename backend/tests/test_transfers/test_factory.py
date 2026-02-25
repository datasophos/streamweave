"""Tests for the transfer adapter factory."""

import pytest

from app.models.instrument import Instrument, ServiceAccount, TransferAdapterType
from app.services.credentials import encrypt_value
from app.transfers.factory import create_adapter
from app.transfers.rclone import RcloneAdapter


def _make_instrument_with_sa(transfer_adapter=TransferAdapterType.rclone):
    sa = ServiceAccount(
        name="test-sa",
        domain="LAB",
        username="labuser",
        password_encrypted=encrypt_value("labpass"),
    )
    inst = Instrument(
        name="Test Microscope",
        cifs_host="192.168.1.10",
        cifs_share="data",
        cifs_base_path="/experiments",
        transfer_adapter=transfer_adapter,
        enabled=True,
    )
    inst.service_account = sa
    return inst


def _make_instrument_no_sa():
    inst = Instrument(
        name="No SA Instrument",
        cifs_host="192.168.1.20",
        cifs_share="data",
        transfer_adapter=TransferAdapterType.rclone,
        enabled=True,
    )
    inst.service_account = None
    return inst


class TestCreateAdapter:
    def test_creates_rclone_adapter(self):
        inst = _make_instrument_with_sa()
        adapter = create_adapter(inst)
        assert isinstance(adapter, RcloneAdapter)

    def test_rclone_adapter_has_correct_host(self):
        inst = _make_instrument_with_sa()
        adapter = create_adapter(inst)
        assert adapter.smb_host == "192.168.1.10"

    def test_rclone_adapter_has_correct_share(self):
        inst = _make_instrument_with_sa()
        adapter = create_adapter(inst)
        assert adapter.smb_share == "data"

    def test_rclone_adapter_has_correct_user(self):
        inst = _make_instrument_with_sa()
        adapter = create_adapter(inst)
        assert adapter.smb_user == "labuser"

    def test_rclone_adapter_has_correct_domain(self):
        inst = _make_instrument_with_sa()
        adapter = create_adapter(inst)
        assert adapter.smb_domain == "LAB"

    def test_rclone_adapter_decrypts_password(self):
        inst = _make_instrument_with_sa()
        adapter = create_adapter(inst)
        assert adapter.smb_password == "labpass"

    def test_raises_for_no_service_account(self):
        inst = _make_instrument_no_sa()
        with pytest.raises(ValueError, match="has no service account"):
            create_adapter(inst)

    def test_raises_for_unsupported_adapter_type(self):
        """Non-rclone adapter raises NotImplementedError."""
        # Create instrument with a fake adapter type
        inst = _make_instrument_with_sa()
        # Temporarily override transfer_adapter attribute
        inst.transfer_adapter = "globus"  # type: ignore[assignment]
        with pytest.raises(NotImplementedError, match="not yet implemented"):
            create_adapter(inst)

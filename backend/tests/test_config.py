import base64

import pytest
from pydantic import ValidationError

from app.config import Settings


def test_valid_fernet_key_accepted():
    from cryptography.fernet import Fernet

    key = Fernet.generate_key().decode()
    s = Settings(streamweave_encryption_key=key)
    assert s.streamweave_encryption_key == key


def test_invalid_base64_raises():
    # "!!!" contains characters that are not valid base64url; validate=True rejects them
    with pytest.raises(ValidationError, match="valid url-safe base64-encoded string"):
        Settings(streamweave_encryption_key="not!!!valid!!!base64")


def test_wrong_length_key_raises():
    # Valid base64url but decodes to fewer than 32 bytes
    short_key = base64.urlsafe_b64encode(b"tooshort").decode()
    with pytest.raises(ValidationError, match="exactly 32 bytes"):
        Settings(streamweave_encryption_key=short_key)

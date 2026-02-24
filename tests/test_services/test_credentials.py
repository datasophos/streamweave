import pytest
from cryptography.fernet import Fernet

from app.config import settings
from app.services.credentials import decrypt_value, encrypt_value


def test_encrypt_decrypt_roundtrip():
    plaintext = "my-secret-password"
    encrypted = encrypt_value(plaintext)
    assert encrypted != plaintext
    decrypted = decrypt_value(encrypted)
    assert decrypted == plaintext


def test_encrypted_value_is_not_plaintext():
    plaintext = "another-secret"
    encrypted = encrypt_value(plaintext)
    assert plaintext not in encrypted


def test_different_encryptions_differ():
    plaintext = "same-input"
    enc1 = encrypt_value(plaintext)
    enc2 = encrypt_value(plaintext)
    # Fernet uses random IVs, so encryptions should differ
    assert enc1 != enc2
    # But both should decrypt to same value
    assert decrypt_value(enc1) == decrypt_value(enc2) == plaintext

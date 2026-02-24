import pytest

from app.models.file import PersistentIdType
from app.services.identifiers import mint_ark, mint_identifier


def test_mint_ark_format():
    ark = mint_ark()
    assert ark.startswith("ark:/99999/fk4")


def test_mint_ark_custom_naan():
    ark = mint_ark(naan="12345")
    assert ark.startswith("ark:/12345/fk4")


def test_mint_ark_custom_shoulder():
    ark = mint_ark(shoulder="xyz")
    assert ark.startswith("ark:/99999/xyz")


def test_mint_ark_uniqueness():
    arks = {mint_ark() for _ in range(100)}
    assert len(arks) == 100


def test_mint_identifier_default():
    pid, pid_type = mint_identifier()
    assert pid_type == PersistentIdType.ark
    assert pid.startswith("ark:/")


def test_mint_identifier_doi_not_implemented():
    with pytest.raises(NotImplementedError):
        mint_identifier(id_type=PersistentIdType.doi)


def test_mint_identifier_handle_not_implemented():
    with pytest.raises(NotImplementedError):
        mint_identifier(id_type=PersistentIdType.handle)

import base64
import uuid

from app.config import settings
from app.models.file import PersistentIdType


def _uuid_to_base32(u: uuid.UUID) -> str:
    return base64.b32encode(u.bytes).decode().rstrip("=").lower()


def mint_ark(naan: str | None = None, shoulder: str | None = None) -> str:
    naan = naan or settings.ark_naan
    shoulder = shoulder or settings.ark_shoulder
    qualifier = _uuid_to_base32(uuid.uuid4())
    return f"ark:/{naan}/{shoulder}{qualifier}"


def mint_identifier(
    id_type: PersistentIdType | None = None,
    naan: str | None = None,
    shoulder: str | None = None,
) -> tuple[str, PersistentIdType]:
    id_type = id_type or PersistentIdType(settings.default_identifier_type)

    if id_type == PersistentIdType.ark:
        return mint_ark(naan=naan, shoulder=shoulder), PersistentIdType.ark

    if id_type == PersistentIdType.doi:
        raise NotImplementedError("DOI minting requires DataCite credentials (Milestone 4)")

    if id_type == PersistentIdType.handle:
        raise NotImplementedError("Handle minting requires Handle.net credentials (Milestone 4)")

    raise ValueError(f"Unknown identifier type: {id_type}")  # pragma: no cover

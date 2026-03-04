"""
Pagination torture tests: large datasets, page correctness, and timing.

These tests verify that:
- Pagination returns correct item counts and totals across many rows.
- Every page covers the dataset without overlap or missing rows.
- COUNT + paginated SELECT complete in reasonable time (guards against N+1 regressions).
"""

import time
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import insert

from app.models.audit import AuditAction, AuditLog
from app.models.instrument import Instrument

# ---------------------------------------------------------------------------
# Large-dataset fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def many_instruments(db_session):
    """Bulk-insert 200 instruments and return the count."""
    rows = [
        {
            "id": uuid.uuid4(),
            "name": f"Instrument {i:03d}",
            "cifs_host": f"10.0.{i // 256}.{i % 256}",
            "cifs_share": "data",
            "transfer_adapter": "rclone",
            "enabled": True,
        }
        for i in range(200)
    ]
    await db_session.execute(insert(Instrument), rows)
    await db_session.flush()
    return 200


@pytest_asyncio.fixture
async def many_audit_logs(db_session):
    """Bulk-insert 100,000 audit log entries using core INSERT to avoid ORM overhead."""
    rows = [
        {
            "id": uuid.uuid4(),
            "entity_type": "instrument",
            "entity_id": uuid.uuid4(),
            "action": AuditAction.create,
            "actor_id": None,
            "actor_email": "bulk@test.com",
            "changes": None,
        }
        for _ in range(100_000)
    ]
    await db_session.execute(insert(AuditLog), rows)
    await db_session.flush()
    return 100_000


# ---------------------------------------------------------------------------
# Instrument pagination correctness
# ---------------------------------------------------------------------------


class TestInstrumentPagination:
    @pytest.mark.asyncio
    async def test_default_page_size_is_25(
        self, client: AsyncClient, admin_headers: dict, many_instruments: int
    ):
        resp = await client.get("/api/instruments", headers=admin_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == many_instruments
        assert len(body["items"]) == 25
        assert body["skip"] == 0
        assert body["limit"] == 25

    @pytest.mark.asyncio
    async def test_second_page_has_correct_items(
        self, client: AsyncClient, admin_headers: dict, many_instruments: int
    ):
        resp = await client.get("/api/instruments?skip=25&limit=25", headers=admin_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == many_instruments
        assert len(body["items"]) == 25

    @pytest.mark.asyncio
    async def test_last_page_is_partial(
        self, client: AsyncClient, admin_headers: dict, many_instruments: int
    ):
        # 200 instruments with limit=30: skip=180 leaves 20 remaining
        resp = await client.get("/api/instruments?skip=180&limit=30", headers=admin_headers)
        body = resp.json()
        assert body["total"] == many_instruments
        assert len(body["items"]) == 20

    @pytest.mark.asyncio
    async def test_skip_beyond_total_returns_empty(
        self, client: AsyncClient, admin_headers: dict, many_instruments: int
    ):
        resp = await client.get("/api/instruments?skip=500&limit=25", headers=admin_headers)
        body = resp.json()
        assert body["total"] == many_instruments
        assert body["items"] == []

    @pytest.mark.asyncio
    async def test_all_pages_cover_total_without_duplicates(
        self, client: AsyncClient, admin_headers: dict, many_instruments: int
    ):
        """Paginate through all instruments and verify no overlap or missing rows."""
        seen_ids: set[str] = set()
        skip = 0
        limit = 50
        total: int | None = None

        while True:
            resp = await client.get(
                f"/api/instruments?skip={skip}&limit={limit}", headers=admin_headers
            )
            body = resp.json()
            if total is None:
                total = body["total"]
            page_ids = {item["id"] for item in body["items"]}
            assert page_ids.isdisjoint(seen_ids), "Duplicate rows detected between pages"
            seen_ids.update(page_ids)
            if len(body["items"]) < limit:
                break
            skip += limit

        assert len(seen_ids) == total

    @pytest.mark.asyncio
    async def test_include_deleted_total_is_accurate(
        self, client: AsyncClient, admin_headers: dict, many_instruments: int
    ):
        """Total counts should differ once an instrument is soft-deleted."""
        # Create one extra instrument via API and then delete it
        create_resp = await client.post(
            "/api/instruments",
            json={"name": "Deletable", "cifs_host": "10.255.0.1", "cifs_share": "data"},
            headers=admin_headers,
        )
        extra_id = create_resp.json()["id"]
        await client.delete(f"/api/instruments/{extra_id}", headers=admin_headers)

        active_resp = await client.get("/api/instruments?limit=1", headers=admin_headers)
        deleted_resp = await client.get(
            "/api/instruments?include_deleted=true&limit=1", headers=admin_headers
        )

        assert active_resp.json()["total"] == many_instruments
        assert deleted_resp.json()["total"] == many_instruments + 1


# ---------------------------------------------------------------------------
# Audit log torture: 100k rows
# ---------------------------------------------------------------------------


class TestAuditLogTorture:
    @pytest.mark.asyncio
    async def test_100k_count_and_page_are_fast(
        self, client: AsyncClient, admin_headers: dict, many_audit_logs: int
    ):
        start = time.monotonic()
        resp = await client.get("/api/admin/audit-logs?limit=50", headers=admin_headers)
        elapsed = time.monotonic() - start

        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == many_audit_logs
        assert len(body["items"]) == 50
        # COUNT(*) + paginated SELECT over 100k rows should complete well under 5 seconds
        # on SQLite in-process. This guards against accidental N+1 query regressions.
        assert elapsed < 5.0, f"Paginated query took too long: {elapsed:.2f}s"

    @pytest.mark.asyncio
    async def test_total_is_stable_across_consecutive_pages(
        self, client: AsyncClient, admin_headers: dict, many_audit_logs: int
    ):
        r1 = await client.get("/api/admin/audit-logs?skip=0&limit=50", headers=admin_headers)
        r2 = await client.get("/api/admin/audit-logs?skip=50&limit=50", headers=admin_headers)
        assert r1.json()["total"] == r2.json()["total"] == many_audit_logs

    @pytest.mark.asyncio
    async def test_pages_have_no_overlap(
        self, client: AsyncClient, admin_headers: dict, many_audit_logs: int
    ):
        r1 = await client.get("/api/admin/audit-logs?skip=0&limit=50", headers=admin_headers)
        r2 = await client.get("/api/admin/audit-logs?skip=50&limit=50", headers=admin_headers)
        ids_p1 = {e["id"] for e in r1.json()["items"]}
        ids_p2 = {e["id"] for e in r2.json()["items"]}
        assert ids_p1.isdisjoint(ids_p2)

    @pytest.mark.asyncio
    async def test_last_page_respects_limit(
        self, client: AsyncClient, admin_headers: dict, many_audit_logs: int
    ):
        # Fetch a page that lands exactly on the boundary — offset such that
        # exactly 37 entries remain (100_000 % 500 = 0, so pick 99_963 for skip)
        skip = 99_963
        limit = 500
        remaining = many_audit_logs - skip  # 37
        resp = await client.get(
            f"/api/admin/audit-logs?skip={skip}&limit={limit}", headers=admin_headers
        )
        body = resp.json()
        assert body["total"] == many_audit_logs
        assert len(body["items"]) == remaining

    @pytest.mark.asyncio
    async def test_entity_type_filter_reduces_total(
        self, client: AsyncClient, admin_headers: dict, many_audit_logs: int
    ):
        """Filtered total should be less than full total when using a non-matching filter."""
        resp = await client.get(
            "/api/admin/audit-logs?entity_type=nonexistent_entity&limit=1",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 0
        assert resp.json()["items"] == []

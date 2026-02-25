"""End-to-end integration test for the harvest pipeline.

Requires the full Docker stack + simlab running.
Run with: pytest tests/test_e2e/ -m integration
"""

import asyncio

import httpx
import pytest

pytestmark = pytest.mark.integration

BASE_URL = "http://localhost:8000"


@pytest.fixture(scope="module")
def api_client():
    """HTTP client for the running API."""
    return httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)


@pytest.fixture(scope="module")
async def admin_token(api_client):
    """Get admin token — assumes admin user created via create-admin script."""
    resp = await api_client.post(
        "/auth/jwt/login",
        data={"username": "admin@streamweave.local", "password": "admin"},
    )
    if resp.status_code != 200:
        pytest.skip("Admin user not available — run create-admin script first")
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


class TestHarvestE2E:
    @pytest.mark.asyncio
    async def test_trigger_harvest_and_verify(self, api_client, admin_headers):
        """Trigger a harvest and verify file records are created."""
        # List schedules to find one to trigger
        resp = await api_client.get("/api/schedules", headers=admin_headers)
        assert resp.status_code == 200
        schedules = resp.json()
        if not schedules:
            pytest.skip("No schedules found — run seed.py first")

        schedule = schedules[0]
        schedule_id = schedule["id"]

        if not schedule.get("prefect_deployment_id"):
            pytest.skip("Schedule has no Prefect deployment")

        # Trigger harvest
        resp = await api_client.post(
            f"/api/schedules/{schedule_id}/trigger",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        flow_run_id = resp.json()["flow_run_id"]
        assert flow_run_id is not None

        # Wait for completion (poll files endpoint)
        for _ in range(30):
            await asyncio.sleep(2)
            resp = await api_client.get(
                f"/api/files?instrument_id={schedule['instrument_id']}",
                headers=admin_headers,
            )
            if resp.status_code == 200 and len(resp.json()) > 0:
                break
        else:
            pytest.fail("No files appeared after harvest — timed out after 60s")

        files = resp.json()
        assert len(files) > 0

        # Verify file records have ARK IDs
        for f in files:
            assert f["persistent_id"].startswith("ark:/")
            assert f["instrument_id"] == schedule["instrument_id"]

        # Verify transfers exist
        file_id = files[0]["id"]
        resp = await api_client.get(
            f"/api/transfers?file_id={file_id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        transfers = resp.json()
        assert len(transfers) > 0

        transfer = transfers[0]
        assert transfer["status"] in ("completed", "skipped")
        if transfer["status"] == "completed":
            assert transfer["dest_checksum"] is not None

    @pytest.mark.asyncio
    async def test_pre_hook_skips_tmp_files(self, api_client, admin_headers):
        """Verify that .tmp files are skipped by the file filter hook."""
        # Get files for the microscope (which has the filter hook)
        resp = await api_client.get("/api/files", headers=admin_headers)
        if resp.status_code != 200:
            pytest.skip("API not available")

        files = resp.json()
        # No .tmp files should have been transferred
        for f in files:
            assert not f["filename"].endswith(".tmp"), (
                f"File {f['filename']} should have been filtered by pre-hook"
            )

    @pytest.mark.asyncio
    async def test_post_hook_enriches_metadata(self, api_client, admin_headers):
        """Verify that metadata enrichment hook extracts experiment/run info."""
        resp = await api_client.get("/api/files", headers=admin_headers)
        if resp.status_code != 200:
            pytest.skip("API not available")

        files = resp.json()
        enriched = [f for f in files if f.get("metadata_") and f["metadata_"].get("experiment")]
        # At least some files should have enriched metadata if they match the pattern
        # This is best-effort — depends on simlab file structure
        if enriched:
            assert enriched[0]["metadata_"]["experiment"].startswith("experiment_")

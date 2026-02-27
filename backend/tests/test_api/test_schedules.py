"""Tests for the harvest schedules API — comprehensive coverage including Prefect integration."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio

from app.models.instrument import Instrument, ServiceAccount, TransferAdapterType
from app.models.schedule import HarvestSchedule
from app.models.storage import StorageLocation, StorageType
from app.services.credentials import encrypt_value


@pytest_asyncio.fixture
async def instrument(db_session):
    sa = ServiceAccount(
        name="test-sa",
        domain="WORKGROUP",
        username="user",
        password_encrypted=encrypt_value("pass"),
    )
    db_session.add(sa)
    await db_session.flush()

    inst = Instrument(
        name="Test Microscope",
        cifs_host="192.168.1.10",
        cifs_share="data",
        service_account_id=sa.id,
        transfer_adapter=TransferAdapterType.rclone,
        enabled=True,
    )
    db_session.add(inst)
    await db_session.flush()
    return inst


@pytest_asyncio.fixture
async def storage(db_session):
    loc = StorageLocation(
        name="Archive",
        type=StorageType.posix,
        base_path="/mnt/archive",
        connection_config={},
        enabled=True,
    )
    db_session.add(loc)
    await db_session.flush()
    return loc


@pytest_asyncio.fixture
async def schedule(db_session, instrument, storage):
    s = HarvestSchedule(
        instrument_id=instrument.id,
        default_storage_location_id=storage.id,
        cron_expression="*/15 * * * *",
        enabled=True,
    )
    db_session.add(s)
    await db_session.flush()
    return s


@pytest_asyncio.fixture
async def schedule_with_prefect_id(db_session, instrument, storage):
    s = HarvestSchedule(
        instrument_id=instrument.id,
        default_storage_location_id=storage.id,
        cron_expression="0 * * * *",
        enabled=True,
        prefect_deployment_id=str(uuid.uuid4()),
    )
    db_session.add(s)
    await db_session.flush()
    return s


class TestSchedulesCRUD:
    @pytest.mark.asyncio
    async def test_list_schedules_empty(self, client, admin_headers):
        resp = await client.get("/api/schedules", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_schedules_with_data(self, client, admin_headers, schedule):
        resp = await client.get("/api/schedules", headers=admin_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_create_schedule_prefect_fails_gracefully(
        self, client, admin_headers, instrument, storage
    ):
        """Schedule is saved even when Prefect deployment creation fails."""
        with patch(
            "app.api.schedules.PrefectClientService.create_deployment",
            new_callable=AsyncMock,
            side_effect=Exception("Prefect unavailable"),
        ):
            resp = await client.post(
                "/api/schedules",
                json={
                    "instrument_id": str(instrument.id),
                    "default_storage_location_id": str(storage.id),
                    "cron_expression": "*/30 * * * *",
                    "enabled": True,
                },
                headers=admin_headers,
            )
        assert resp.status_code == 201
        body = resp.json()
        assert body["cron_expression"] == "*/30 * * * *"
        # No prefect_deployment_id since it failed
        assert body["prefect_deployment_id"] is None

    @pytest.mark.asyncio
    async def test_create_schedule_prefect_succeeds(
        self, client, admin_headers, instrument, storage
    ):
        """When Prefect succeeds, deployment_id is saved."""
        fake_deployment_id = str(uuid.uuid4())
        with patch(
            "app.api.schedules.PrefectClientService.create_deployment",
            new_callable=AsyncMock,
            return_value=fake_deployment_id,
        ):
            resp = await client.post(
                "/api/schedules",
                json={
                    "instrument_id": str(instrument.id),
                    "default_storage_location_id": str(storage.id),
                    "cron_expression": "0 * * * *",
                    "enabled": True,
                },
                headers=admin_headers,
            )
        assert resp.status_code == 201
        body = resp.json()
        assert body["prefect_deployment_id"] == fake_deployment_id

    @pytest.mark.asyncio
    async def test_create_schedule_prefect_returns_none(
        self, client, admin_headers, instrument, storage
    ):
        """When Prefect returns None, no deployment_id is stored."""
        with patch(
            "app.api.schedules.PrefectClientService.create_deployment",
            new_callable=AsyncMock,
            return_value=None,
        ):
            resp = await client.post(
                "/api/schedules",
                json={
                    "instrument_id": str(instrument.id),
                    "default_storage_location_id": str(storage.id),
                    "cron_expression": "0 6 * * *",
                    "enabled": True,
                },
                headers=admin_headers,
            )
        assert resp.status_code == 201
        # No deployment_id since create_deployment returned None
        assert resp.json()["prefect_deployment_id"] is None

    @pytest.mark.asyncio
    async def test_create_schedule_instrument_not_found_for_prefect(
        self, client, admin_headers, storage
    ):
        """When instrument_id doesn't match any instrument, schedule is still saved."""
        nonexistent_instrument_id = str(uuid.uuid4())
        with patch(
            "app.api.schedules.PrefectClientService.create_deployment",
            new_callable=AsyncMock,
            return_value=None,
        ):
            resp = await client.post(
                "/api/schedules",
                json={
                    "instrument_id": nonexistent_instrument_id,
                    "default_storage_location_id": str(storage.id),
                    "cron_expression": "0 12 * * *",
                    "enabled": True,
                },
                headers=admin_headers,
            )
        # Should succeed — instrument existence is not validated by the API
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_get_schedule(self, client, admin_headers, schedule):
        resp = await client.get(f"/api/schedules/{schedule.id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["cron_expression"] == "*/15 * * * *"

    @pytest.mark.asyncio
    async def test_get_nonexistent_schedule(self, client, admin_headers):
        resp = await client.get(f"/api/schedules/{uuid.uuid4()}", headers=admin_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_schedule_no_prefect(self, client, admin_headers, schedule):
        """Update without prefect_deployment_id — no Prefect call made."""
        resp = await client.patch(
            f"/api/schedules/{schedule.id}",
            json={"enabled": False},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["enabled"] is False

    @pytest.mark.asyncio
    async def test_update_schedule_with_prefect_cron(
        self, client, admin_headers, schedule_with_prefect_id
    ):
        """Update cron when deployment_id exists — calls Prefect update."""
        s = schedule_with_prefect_id
        with patch(
            "app.api.schedules.PrefectClientService.update_deployment",
            new_callable=AsyncMock,
            return_value=True,
        ) as mock_update:
            resp = await client.patch(
                f"/api/schedules/{s.id}",
                json={"cron_expression": "0 2 * * *"},
                headers=admin_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["cron_expression"] == "0 2 * * *"
        mock_update.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_update_schedule_with_prefect_enabled(
        self, client, admin_headers, schedule_with_prefect_id
    ):
        """Update enabled when deployment_id exists — calls Prefect update."""
        s = schedule_with_prefect_id
        with patch(
            "app.api.schedules.PrefectClientService.update_deployment",
            new_callable=AsyncMock,
            return_value=True,
        ) as mock_update:
            resp = await client.patch(
                f"/api/schedules/{s.id}",
                json={"enabled": False},
                headers=admin_headers,
            )
        assert resp.status_code == 200
        mock_update.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_update_schedule_prefect_fails_gracefully(
        self, client, admin_headers, schedule_with_prefect_id
    ):
        """Prefect update failure doesn't break the API response."""
        s = schedule_with_prefect_id
        with patch(
            "app.api.schedules.PrefectClientService.update_deployment",
            new_callable=AsyncMock,
            side_effect=Exception("Prefect down"),
        ):
            resp = await client.patch(
                f"/api/schedules/{s.id}",
                json={"cron_expression": "0 3 * * *"},
                headers=admin_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["cron_expression"] == "0 3 * * *"

    @pytest.mark.asyncio
    async def test_update_nonexistent_schedule(self, client, admin_headers):
        resp = await client.patch(
            f"/api/schedules/{uuid.uuid4()}",
            json={"enabled": False},
            headers=admin_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_schedule_no_prefect(self, client, admin_headers, schedule):
        """Delete schedule without prefect_deployment_id."""
        resp = await client.delete(f"/api/schedules/{schedule.id}", headers=admin_headers)
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_schedule_with_prefect(
        self, client, admin_headers, schedule_with_prefect_id
    ):
        """Delete schedule with prefect_deployment_id — calls Prefect delete."""
        s = schedule_with_prefect_id
        with patch(
            "app.api.schedules.PrefectClientService.delete_deployment",
            new_callable=AsyncMock,
            return_value=True,
        ) as mock_delete:
            resp = await client.delete(f"/api/schedules/{s.id}", headers=admin_headers)
        assert resp.status_code == 204
        mock_delete.assert_awaited_once_with(s.prefect_deployment_id)

    @pytest.mark.asyncio
    async def test_delete_schedule_prefect_fails_gracefully(
        self, client, admin_headers, schedule_with_prefect_id
    ):
        """Prefect delete failure doesn't break the API response."""
        s = schedule_with_prefect_id
        with patch(
            "app.api.schedules.PrefectClientService.delete_deployment",
            new_callable=AsyncMock,
            side_effect=Exception("Prefect down"),
        ):
            resp = await client.delete(f"/api/schedules/{s.id}", headers=admin_headers)
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_nonexistent_schedule(self, client, admin_headers):
        resp = await client.delete(f"/api/schedules/{uuid.uuid4()}", headers=admin_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_restore_schedule(self, client, admin_headers, schedule):
        await client.delete(f"/api/schedules/{schedule.id}", headers=admin_headers)
        resp = await client.post(f"/api/schedules/{schedule.id}/restore", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == str(schedule.id)

    @pytest.mark.asyncio
    async def test_restore_non_deleted_schedule_returns_404(self, client, admin_headers, schedule):
        resp = await client.post(f"/api/schedules/{schedule.id}/restore", headers=admin_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_non_admin_rejected(self, client, regular_headers):
        resp = await client.get("/api/schedules", headers=regular_headers)
        assert resp.status_code == 403


class TestTriggerHarvest:
    @pytest.mark.asyncio
    async def test_trigger_no_deployment_id(self, client, admin_headers, schedule):
        """Trigger fails with 400 when no Prefect deployment_id."""
        resp = await client.post(
            f"/api/schedules/{schedule.id}/trigger",
            headers=admin_headers,
        )
        assert resp.status_code == 400
        assert "no Prefect deployment" in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_trigger_nonexistent_schedule(self, client, admin_headers):
        resp = await client.post(
            f"/api/schedules/{uuid.uuid4()}/trigger",
            headers=admin_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_trigger_success(self, client, admin_headers, schedule_with_prefect_id):
        """Successful trigger returns flow_run_id."""
        s = schedule_with_prefect_id
        fake_flow_run_id = str(uuid.uuid4())
        with patch(
            "app.api.schedules.PrefectClientService.trigger_harvest",
            new_callable=AsyncMock,
            return_value=fake_flow_run_id,
        ):
            resp = await client.post(
                f"/api/schedules/{s.id}/trigger",
                headers=admin_headers,
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["flow_run_id"] == fake_flow_run_id
        assert body["schedule_id"] == str(s.id)

    @pytest.mark.asyncio
    async def test_trigger_prefect_unavailable(
        self, client, admin_headers, schedule_with_prefect_id
    ):
        """When Prefect returns None, returns 502."""
        s = schedule_with_prefect_id
        with patch(
            "app.api.schedules.PrefectClientService.trigger_harvest",
            new_callable=AsyncMock,
            return_value=None,
        ):
            resp = await client.post(
                f"/api/schedules/{s.id}/trigger",
                headers=admin_headers,
            )
        assert resp.status_code == 502

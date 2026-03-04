import uuid
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.instrument import Instrument, TransferAdapterType
from app.models.schedule import HarvestSchedule
from app.models.storage import StorageLocation, StorageType
from app.services.credentials import encrypt_value


@pytest_asyncio.fixture
async def instrument_with_schedule(db_session):
    from app.models.instrument import ServiceAccount

    sa = ServiceAccount(
        name="test-sa",
        domain=None,
        username="user",
        password_encrypted=encrypt_value("pass"),
    )
    db_session.add(sa)
    await db_session.flush()

    inst = Instrument(
        name="Harvest Instrument",
        cifs_host="192.168.1.99",
        cifs_share="data",
        service_account_id=sa.id,
        transfer_adapter=TransferAdapterType.rclone,
        enabled=True,
    )
    db_session.add(inst)
    await db_session.flush()

    storage = StorageLocation(
        name="Test Archive",
        type=StorageType.posix,
        base_path="/mnt/archive",
        connection_config={},
        enabled=True,
    )
    db_session.add(storage)
    await db_session.flush()

    schedule = HarvestSchedule(
        instrument_id=inst.id,
        default_storage_location_id=storage.id,
        cron_expression="0 * * * *",
        enabled=True,
        prefect_deployment_id=str(uuid.uuid4()),
    )
    db_session.add(schedule)
    await db_session.flush()

    return inst, schedule


@pytest.mark.asyncio
async def test_list_instruments_unauthenticated(client: AsyncClient):
    response = await client.get("/api/instruments")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_instrument(client: AsyncClient, admin_headers: dict):
    data = {
        "name": "Test Microscope",
        "description": "A test instrument",
        "cifs_host": "192.168.1.100",
        "cifs_share": "microscope",
    }
    response = await client.post("/api/instruments", json=data, headers=admin_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Test Microscope"
    assert body["cifs_host"] == "192.168.1.100"
    assert body["enabled"] is True
    assert "id" in body


@pytest.mark.asyncio
async def test_list_instruments(client: AsyncClient, admin_headers: dict):
    # Create one first
    await client.post(
        "/api/instruments",
        json={"name": "Inst1", "cifs_host": "h1", "cifs_share": "s1"},
        headers=admin_headers,
    )
    response = await client.get("/api/instruments", headers=admin_headers)
    assert response.status_code == 200
    assert len(response.json()["items"]) >= 1


@pytest.mark.asyncio
async def test_get_instrument(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "Inst2", "cifs_host": "h2", "cifs_share": "s2"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    response = await client.get(f"/api/instruments/{inst_id}", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Inst2"


@pytest.mark.asyncio
async def test_update_instrument(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "Inst3", "cifs_host": "h3", "cifs_share": "s3"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    response = await client.patch(
        f"/api/instruments/{inst_id}",
        json={"name": "Updated Inst3"},
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Inst3"


@pytest.mark.asyncio
async def test_delete_instrument(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "Inst4", "cifs_host": "h4", "cifs_share": "s4"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    response = await client.delete(f"/api/instruments/{inst_id}", headers=admin_headers)
    assert response.status_code == 204

    # Verify deleted
    response = await client.get(f"/api/instruments/{inst_id}", headers=admin_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_nonexistent_instrument(client: AsyncClient, admin_headers: dict):
    import uuid

    response = await client.get(f"/api/instruments/{uuid.uuid4()}", headers=admin_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_nonexistent_instrument(client: AsyncClient, admin_headers: dict):
    import uuid

    response = await client.patch(
        f"/api/instruments/{uuid.uuid4()}",
        json={"name": "X"},
        headers=admin_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_instrument(client: AsyncClient, admin_headers: dict):
    import uuid

    response = await client.delete(
        f"/api/instruments/{uuid.uuid4()}",
        headers=admin_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_regular_user_can_list_instruments(
    client: AsyncClient, admin_headers: dict, regular_headers: dict
):
    await client.post(
        "/api/instruments",
        json={"name": "Readable Instrument", "cifs_host": "192.168.1.1", "cifs_share": "data"},
        headers=admin_headers,
    )
    response = await client.get("/api/instruments", headers=regular_headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_regular_user_cannot_create_instrument(client: AsyncClient, regular_headers: dict):
    response = await client.post(
        "/api/instruments",
        json={"name": "X", "cifs_host": "192.168.1.1", "cifs_share": "data"},
        headers=regular_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_soft_delete_excluded_from_list(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "ToDelete", "cifs_host": "h", "cifs_share": "s"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    await client.delete(f"/api/instruments/{inst_id}", headers=admin_headers)

    # Default list excludes deleted
    list_resp = await client.get("/api/instruments", headers=admin_headers)
    ids = [i["id"] for i in list_resp.json()["items"]]
    assert inst_id not in ids

    # include_deleted=true shows it
    list_resp2 = await client.get("/api/instruments?include_deleted=true", headers=admin_headers)
    ids2 = [i["id"] for i in list_resp2.json()["items"]]
    assert inst_id in ids2


@pytest.mark.asyncio
async def test_restore_instrument(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "RestoreMe", "cifs_host": "h", "cifs_share": "s"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    await client.delete(f"/api/instruments/{inst_id}", headers=admin_headers)

    # Restore
    restore_resp = await client.post(f"/api/instruments/{inst_id}/restore", headers=admin_headers)
    assert restore_resp.status_code == 200
    assert restore_resp.json()["id"] == inst_id

    # Now appears in regular list
    list_resp = await client.get("/api/instruments", headers=admin_headers)
    ids = [i["id"] for i in list_resp.json()["items"]]
    assert inst_id in ids


@pytest.mark.asyncio
async def test_restore_non_deleted_instrument_returns_404(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "NotDeleted", "cifs_host": "h", "cifs_share": "s"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    # Instrument is active (not deleted) — restore should 404
    restore_resp = await client.post(f"/api/instruments/{inst_id}/restore", headers=admin_headers)
    assert restore_resp.status_code == 404


@pytest.mark.asyncio
async def test_regular_user_cannot_delete_instrument(
    client: AsyncClient, admin_headers: dict, regular_headers: dict
):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "Y", "cifs_host": "192.168.1.2", "cifs_share": "data"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    response = await client.delete(f"/api/instruments/{inst_id}", headers=regular_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_instrument_read_includes_last_harvested_at(client: AsyncClient, admin_headers: dict):
    resp = await client.post(
        "/api/instruments",
        json={"name": "HarvestCheck", "cifs_host": "h", "cifs_share": "s"},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert "last_harvested_at" in body
    assert body["last_harvested_at"] is None


@pytest.mark.asyncio
async def test_trigger_harvest_no_schedules(client: AsyncClient, admin_headers: dict):
    resp = await client.post(
        "/api/instruments",
        json={"name": "NoSched", "cifs_host": "h", "cifs_share": "s"},
        headers=admin_headers,
    )
    inst_id = resp.json()["id"]
    harvest_resp = await client.post(f"/api/instruments/{inst_id}/harvest", headers=admin_headers)
    assert harvest_resp.status_code == 400
    assert "No active schedules" in harvest_resp.json()["detail"]


@pytest.mark.asyncio
async def test_trigger_harvest_nonexistent_instrument(client: AsyncClient, admin_headers: dict):
    harvest_resp = await client.post(
        f"/api/instruments/{uuid.uuid4()}/harvest", headers=admin_headers
    )
    assert harvest_resp.status_code == 404


@pytest.mark.asyncio
async def test_trigger_harvest_success(
    client: AsyncClient,
    admin_headers: dict,
    instrument_with_schedule,
):
    inst, schedule = instrument_with_schedule
    mock_flow_run_id = str(uuid.uuid4())

    with patch(
        "app.api.instruments.PrefectClientService.trigger_harvest",
        new=AsyncMock(return_value=mock_flow_run_id),
    ):
        resp = await client.post(f"/api/instruments/{inst.id}/harvest", headers=admin_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["triggered"]) == 1
    assert body["triggered"][0]["flow_run_id"] == mock_flow_run_id
    assert body["triggered"][0]["schedule_id"] == str(schedule.id)
    assert body["errors"] == []


@pytest.mark.asyncio
async def test_trigger_harvest_prefect_unavailable(
    client: AsyncClient,
    admin_headers: dict,
    instrument_with_schedule,
):
    inst, _schedule = instrument_with_schedule

    with patch(
        "app.api.instruments.PrefectClientService.trigger_harvest",
        new=AsyncMock(return_value=None),
    ):
        resp = await client.post(f"/api/instruments/{inst.id}/harvest", headers=admin_headers)

    assert resp.status_code == 502


@pytest.mark.asyncio
async def test_trigger_harvest_requires_admin(
    client: AsyncClient,
    admin_headers: dict,
    regular_headers: dict,
    instrument_with_schedule,
):
    inst, _schedule = instrument_with_schedule
    resp = await client.post(f"/api/instruments/{inst.id}/harvest", headers=regular_headers)
    assert resp.status_code == 403

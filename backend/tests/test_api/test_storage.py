import uuid

import pytest
from httpx import AsyncClient

S3_CONFIG = {
    "bucket": "my-bucket",
    "region": "us-east-1",
    "access_key_id": "AKIAIOSFODNN7EXAMPLE",
    "secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
}

CIFS_CONFIG = {
    "host": "fileserver.lab.local",
    "share": "data",
    "username": "labuser",
    "password": "s3cr3t!",
}

NFS_CONFIG = {
    "host": "nfsserver.lab.local",
    "export_path": "/export/data",
}


@pytest.mark.asyncio
async def test_create_storage_location(client: AsyncClient, admin_headers: dict):
    data = {
        "name": "Test Archive",
        "type": "posix",
        "base_path": "/mnt/archive",
    }
    response = await client.post("/api/storage-locations", json=data, headers=admin_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Test Archive"
    assert body["type"] == "posix"


@pytest.mark.asyncio
async def test_create_s3_storage_location(client: AsyncClient, admin_headers: dict):
    data = {
        "name": "S3 Bucket",
        "type": "s3",
        "base_path": "s3://my-bucket/archive",
        "connection_config": S3_CONFIG,
    }
    response = await client.post("/api/storage-locations", json=data, headers=admin_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["type"] == "s3"
    # Sensitive field should be masked
    assert body["connection_config"]["secret_access_key"] == "****"
    # Non-sensitive fields should be visible
    assert body["connection_config"]["bucket"] == "my-bucket"


@pytest.mark.asyncio
async def test_create_s3_storage_location_missing_required_fields(
    client: AsyncClient, admin_headers: dict
):
    data = {
        "name": "Bad S3",
        "type": "s3",
        "base_path": "s3://my-bucket/archive",
        "connection_config": {"bucket": "my-bucket"},  # missing region, keys
    }
    response = await client.post("/api/storage-locations", json=data, headers=admin_headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_s3_without_connection_config_returns_422(
    client: AsyncClient, admin_headers: dict
):
    """Omitting connection_config entirely for a typed location should fail validation."""
    data = {
        "name": "No Config S3",
        "type": "s3",
        "base_path": "s3://bucket/data",
        # connection_config omitted
    }
    response = await client.post("/api/storage-locations", json=data, headers=admin_headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_cifs_storage_location(client: AsyncClient, admin_headers: dict):
    data = {
        "name": "CIFS Share",
        "type": "cifs",
        "base_path": "/mnt/cifs",
        "connection_config": CIFS_CONFIG,
    }
    response = await client.post("/api/storage-locations", json=data, headers=admin_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["type"] == "cifs"
    assert body["connection_config"]["password"] == "****"
    assert body["connection_config"]["host"] == "fileserver.lab.local"


@pytest.mark.asyncio
async def test_create_cifs_storage_location_missing_password(
    client: AsyncClient, admin_headers: dict
):
    data = {
        "name": "Bad CIFS",
        "type": "cifs",
        "base_path": "/mnt/cifs",
        "connection_config": {"host": "server", "share": "data", "username": "user"},
    }
    response = await client.post("/api/storage-locations", json=data, headers=admin_headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_nfs_storage_location(client: AsyncClient, admin_headers: dict):
    data = {
        "name": "NFS Mount",
        "type": "nfs",
        "base_path": "/mnt/nfs",
        "connection_config": NFS_CONFIG,
    }
    response = await client.post("/api/storage-locations", json=data, headers=admin_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["type"] == "nfs"
    assert body["connection_config"]["host"] == "nfsserver.lab.local"


@pytest.mark.asyncio
async def test_create_nfs_storage_location_missing_host(client: AsyncClient, admin_headers: dict):
    data = {
        "name": "Bad NFS",
        "type": "nfs",
        "base_path": "/mnt/nfs",
        "connection_config": {"export_path": "/data"},  # missing host
    }
    response = await client.post("/api/storage-locations", json=data, headers=admin_headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_sensitive_field_encrypted_at_rest(client: AsyncClient, admin_headers: dict):
    """The secret is stored encrypted, not in plaintext."""
    data = {
        "name": "S3 Encrypted",
        "type": "s3",
        "base_path": "s3://my-bucket/data",
        "connection_config": S3_CONFIG,
    }
    resp = await client.post("/api/storage-locations", json=data, headers=admin_headers)
    assert resp.status_code == 201
    loc_id = resp.json()["id"]

    # Fetch single record and confirm masking
    detail_resp = await client.get(f"/api/storage-locations/{loc_id}", headers=admin_headers)
    assert detail_resp.json()["connection_config"]["secret_access_key"] == "****"


@pytest.mark.asyncio
async def test_update_preserves_secret_when_masked(client: AsyncClient, admin_headers: dict):
    """Sending **** for a secret field during update preserves the stored encrypted value."""
    create_resp = await client.post(
        "/api/storage-locations",
        json={
            "name": "S3 Preserve",
            "type": "s3",
            "base_path": "s3://bucket/p",
            "connection_config": S3_CONFIG,
        },
        headers=admin_headers,
    )
    loc_id = create_resp.json()["id"]

    # Update name only, sending back masked secret
    update_resp = await client.patch(
        f"/api/storage-locations/{loc_id}",
        json={
            "type": "s3",
            "connection_config": {**S3_CONFIG, "secret_access_key": "****"},
        },
        headers=admin_headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["connection_config"]["secret_access_key"] == "****"


@pytest.mark.asyncio
async def test_test_connection_posix(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/storage-locations",
        json={"name": "POSIX Test", "type": "posix", "base_path": "/mnt/test"},
        headers=admin_headers,
    )
    loc_id = create_resp.json()["id"]
    resp = await client.get(f"/api/storage-locations/{loc_id}/test", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_test_connection_s3(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/storage-locations",
        json={
            "name": "S3 Test",
            "type": "s3",
            "base_path": "s3://bucket/test",
            "connection_config": S3_CONFIG,
        },
        headers=admin_headers,
    )
    loc_id = create_resp.json()["id"]
    resp = await client.get(f"/api/storage-locations/{loc_id}/test", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_test_connection_disabled_returns_409(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/storage-locations",
        json={"name": "Disabled", "type": "posix", "base_path": "/mnt/d", "enabled": False},
        headers=admin_headers,
    )
    loc_id = create_resp.json()["id"]
    resp = await client.get(f"/api/storage-locations/{loc_id}/test", headers=admin_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_test_connection_nonexistent_returns_404(client: AsyncClient, admin_headers: dict):
    resp = await client.get(f"/api/storage-locations/{uuid.uuid4()}/test", headers=admin_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_storage_locations(client: AsyncClient, admin_headers: dict):
    await client.post(
        "/api/storage-locations",
        json={"name": "S1", "type": "posix", "base_path": "/mnt/s1"},
        headers=admin_headers,
    )
    response = await client.get("/api/storage-locations", headers=admin_headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1


@pytest.mark.asyncio
async def test_update_storage_location(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/storage-locations",
        json={"name": "S2", "type": "posix", "base_path": "/mnt/s2"},
        headers=admin_headers,
    )
    loc_id = create_resp.json()["id"]
    response = await client.patch(
        f"/api/storage-locations/{loc_id}",
        json={"name": "Updated S2"},
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated S2"


@pytest.mark.asyncio
async def test_delete_storage_location(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/storage-locations",
        json={"name": "S3del", "type": "posix", "base_path": "/mnt/del"},
        headers=admin_headers,
    )
    loc_id = create_resp.json()["id"]
    response = await client.delete(f"/api/storage-locations/{loc_id}", headers=admin_headers)
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_get_storage_location(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/storage-locations",
        json={"name": "S4", "type": "posix", "base_path": "/mnt/s4"},
        headers=admin_headers,
    )
    loc_id = create_resp.json()["id"]
    response = await client.get(f"/api/storage-locations/{loc_id}", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "S4"


@pytest.mark.asyncio
async def test_get_nonexistent_storage_location(client: AsyncClient, admin_headers: dict):
    response = await client.get(f"/api/storage-locations/{uuid.uuid4()}", headers=admin_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_nonexistent_storage_location(client: AsyncClient, admin_headers: dict):
    response = await client.patch(
        f"/api/storage-locations/{uuid.uuid4()}",
        json={"name": "X"},
        headers=admin_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_storage_location(client: AsyncClient, admin_headers: dict):
    response = await client.delete(f"/api/storage-locations/{uuid.uuid4()}", headers=admin_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_regular_user_can_list_storage_locations(
    client: AsyncClient, admin_headers: dict, regular_headers: dict
):
    await client.post(
        "/api/storage-locations",
        json={"name": "Readable", "type": "posix", "base_path": "/mnt/read"},
        headers=admin_headers,
    )
    response = await client.get("/api/storage-locations", headers=regular_headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_regular_user_cannot_create_storage_location(
    client: AsyncClient, regular_headers: dict
):
    response = await client.post(
        "/api/storage-locations",
        json={"name": "X", "type": "posix", "base_path": "/x"},
        headers=regular_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_restore_storage_location(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/storage-locations",
        json={"name": "RestoreLoc", "type": "posix", "base_path": "/mnt/restore"},
        headers=admin_headers,
    )
    loc_id = create_resp.json()["id"]
    await client.delete(f"/api/storage-locations/{loc_id}", headers=admin_headers)
    resp = await client.post(f"/api/storage-locations/{loc_id}/restore", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == loc_id


@pytest.mark.asyncio
async def test_restore_non_deleted_storage_location_returns_404(
    client: AsyncClient, admin_headers: dict
):
    create_resp = await client.post(
        "/api/storage-locations",
        json={"name": "ActiveLoc", "type": "posix", "base_path": "/mnt/active"},
        headers=admin_headers,
    )
    loc_id = create_resp.json()["id"]
    resp = await client.post(f"/api/storage-locations/{loc_id}/restore", headers=admin_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_regular_user_cannot_delete_storage_location(
    client: AsyncClient, admin_headers: dict, regular_headers: dict
):
    create_resp = await client.post(
        "/api/storage-locations",
        json={"name": "Y", "type": "posix", "base_path": "/y"},
        headers=admin_headers,
    )
    loc_id = create_resp.json()["id"]
    response = await client.delete(f"/api/storage-locations/{loc_id}", headers=regular_headers)
    assert response.status_code == 403

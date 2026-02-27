"""Tests for the hooks CRUD API."""

import uuid

import pytest
import pytest_asyncio

from app.models.hook import HookConfig, HookImplementation, HookTrigger


@pytest_asyncio.fixture
async def hook(db_session):
    h = HookConfig(
        name="Test Filter",
        trigger=HookTrigger.pre_transfer,
        implementation=HookImplementation.builtin,
        builtin_name="file_filter",
        config={"exclude_patterns": ["*.tmp"]},
        priority=0,
        enabled=True,
    )
    db_session.add(h)
    await db_session.flush()
    return h


class TestHooksCRUD:
    @pytest.mark.asyncio
    async def test_list_hooks_empty(self, client, admin_headers):
        resp = await client.get("/api/hooks", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_hooks_with_data(self, client, admin_headers, hook):
        resp = await client.get("/api/hooks", headers=admin_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["name"] == "Test Filter"

    @pytest.mark.asyncio
    async def test_create_hook(self, client, admin_headers):
        data = {
            "name": "New Hook",
            "trigger": "pre_transfer",
            "implementation": "builtin",
            "builtin_name": "file_filter",
            "config": {"exclude_patterns": ["*.log"]},
            "priority": 5,
            "enabled": True,
        }
        resp = await client.post("/api/hooks", json=data, headers=admin_headers)
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "New Hook"
        assert body["trigger"] == "pre_transfer"
        assert body["enabled"] is True
        assert "id" in body

    @pytest.mark.asyncio
    async def test_get_hook(self, client, admin_headers, hook):
        resp = await client.get(f"/api/hooks/{hook.id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test Filter"

    @pytest.mark.asyncio
    async def test_get_nonexistent_hook(self, client, admin_headers):
        resp = await client.get(f"/api/hooks/{uuid.uuid4()}", headers=admin_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_hook(self, client, admin_headers, hook):
        resp = await client.patch(
            f"/api/hooks/{hook.id}",
            json={"name": "Renamed Hook", "enabled": False},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Renamed Hook"
        assert body["enabled"] is False

    @pytest.mark.asyncio
    async def test_update_nonexistent_hook(self, client, admin_headers):
        resp = await client.patch(
            f"/api/hooks/{uuid.uuid4()}",
            json={"name": "X"},
            headers=admin_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_hook(self, client, admin_headers, hook):
        resp = await client.delete(f"/api/hooks/{hook.id}", headers=admin_headers)
        assert resp.status_code == 204
        # Verify deleted
        resp = await client.get(f"/api/hooks/{hook.id}", headers=admin_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_hook(self, client, admin_headers):
        resp = await client.delete(f"/api/hooks/{uuid.uuid4()}", headers=admin_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_restore_hook(self, client, admin_headers, hook):
        await client.delete(f"/api/hooks/{hook.id}", headers=admin_headers)
        resp = await client.post(f"/api/hooks/{hook.id}/restore", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == str(hook.id)

    @pytest.mark.asyncio
    async def test_restore_non_deleted_hook_returns_404(self, client, admin_headers, hook):
        resp = await client.post(f"/api/hooks/{hook.id}/restore", headers=admin_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_non_admin_rejected(self, client, regular_headers):
        resp = await client.get("/api/hooks", headers=regular_headers)
        assert resp.status_code == 403

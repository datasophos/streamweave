"""Tests for the access_assignment builtin hook."""

import pytest

from app.hooks.base import HookAction, HookContext
from app.hooks.builtin.access_assignment import AccessAssignmentHook


def _ctx(metadata: dict | None = None) -> HookContext:
    return HookContext(
        source_path="exp/image.tif",
        filename="image.tif",
        instrument_id="test-id",
        instrument_name="test",
        metadata=metadata or {},
        transfer_success=True,
    )


class TestAccessAssignment:
    @pytest.mark.asyncio
    async def test_literal_grant(self):
        hook = AccessAssignmentHook(
            config={
                "grants": [
                    {"grantee_type": "user", "match_field": "abc-123", "source": "literal"},
                ]
            }
        )
        result = await hook.execute(_ctx())
        assert result.action == HookAction.proceed
        assert len(result.access_grants) == 1
        assert result.access_grants[0]["grantee_type"] == "user"
        assert result.access_grants[0]["grantee_id"] == "abc-123"

    @pytest.mark.asyncio
    async def test_metadata_grant(self):
        hook = AccessAssignmentHook(
            config={
                "grants": [
                    {"grantee_type": "user", "match_field": "username", "source": "metadata"},
                ]
            }
        )
        result = await hook.execute(_ctx(metadata={"username": "jdoe"}))
        assert len(result.access_grants) == 1
        assert result.access_grants[0]["grantee_type"] == "user"
        assert result.access_grants[0]["resolve_field"] == "username"
        assert result.access_grants[0]["resolve_value"] == "jdoe"

    @pytest.mark.asyncio
    async def test_metadata_grant_missing_key(self):
        hook = AccessAssignmentHook(
            config={
                "grants": [
                    {"grantee_type": "user", "match_field": "username", "source": "metadata"},
                ]
            }
        )
        result = await hook.execute(_ctx(metadata={}))
        assert len(result.access_grants) == 0

    @pytest.mark.asyncio
    async def test_empty_config(self):
        hook = AccessAssignmentHook(config={})
        result = await hook.execute(_ctx())
        assert result.action == HookAction.proceed
        assert len(result.access_grants) == 0

    @pytest.mark.asyncio
    async def test_multiple_grants(self):
        hook = AccessAssignmentHook(
            config={
                "grants": [
                    {"grantee_type": "user", "match_field": "user-id-1", "source": "literal"},
                    {"grantee_type": "group", "match_field": "team_name", "source": "metadata"},
                ]
            }
        )
        result = await hook.execute(_ctx(metadata={"team_name": "Lab A"}))
        assert len(result.access_grants) == 2

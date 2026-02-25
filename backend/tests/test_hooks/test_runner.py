"""Tests for the hook runner."""

import pytest

from app.hooks.base import HookAction, HookContext, HookResult
from app.hooks.runner import run_hooks
from app.models.hook import HookConfig, HookImplementation, HookTrigger


def _make_hook_config(
    name: str,
    trigger: HookTrigger,
    builtin_name: str,
    config: dict | None = None,
    priority: int = 0,
    enabled: bool = True,
) -> HookConfig:
    return HookConfig(
        name=name,
        trigger=trigger,
        implementation=HookImplementation.builtin,
        builtin_name=builtin_name,
        config=config or {},
        priority=priority,
        enabled=enabled,
    )


def _ctx() -> HookContext:
    return HookContext(
        source_path="exp_001/image.tmp",
        filename="image.tmp",
        instrument_id="test-id",
        instrument_name="test",
    )


class TestPreTransferShortCircuit:
    @pytest.mark.asyncio
    async def test_skip_short_circuits(self):
        hooks = [
            _make_hook_config(
                "filter", HookTrigger.pre_transfer, "file_filter",
                config={"exclude_patterns": ["*.tmp"]}, priority=0,
            ),
            _make_hook_config(
                "enrichment", HookTrigger.pre_transfer, "metadata_enrichment",
                config={"rules": [{"pattern": r"(?P<x>\w+)", "source": "filename"}]},
                priority=1,
            ),
        ]
        result = await run_hooks(HookTrigger.pre_transfer, _ctx(), hooks)
        assert result.action == HookAction.skip

    @pytest.mark.asyncio
    async def test_proceed_continues(self):
        hooks = [
            _make_hook_config(
                "filter", HookTrigger.pre_transfer, "file_filter",
                config={"exclude_patterns": ["*.xyz"]}, priority=0,
            ),
        ]
        result = await run_hooks(HookTrigger.pre_transfer, _ctx(), hooks)
        assert result.action == HookAction.proceed


class TestPriorityOrdering:
    @pytest.mark.asyncio
    async def test_lower_priority_runs_first(self):
        hooks = [
            # Allow hook (priority=10)
            _make_hook_config(
                "allow", HookTrigger.pre_transfer, "file_filter",
                config={"include_patterns": ["*.tmp"]}, priority=10,
            ),
            # Exclude hook (priority=0 — runs first)
            _make_hook_config(
                "deny", HookTrigger.pre_transfer, "file_filter",
                config={"exclude_patterns": ["*.tmp"]}, priority=0,
            ),
        ]
        result = await run_hooks(HookTrigger.pre_transfer, _ctx(), hooks)
        # Priority 0 runs first and skips
        assert result.action == HookAction.skip


class TestPostTransferMerge:
    @pytest.mark.asyncio
    async def test_merges_metadata(self):
        hooks = [
            _make_hook_config(
                "enrich1", HookTrigger.post_transfer, "metadata_enrichment",
                config={"rules": [{"pattern": r"(?P<experiment>exp_\d+)", "source": "path"}]},
                priority=0,
            ),
            _make_hook_config(
                "enrich2", HookTrigger.post_transfer, "metadata_enrichment",
                config={"rules": [{"pattern": r"(?P<ext>\.tmp$)", "source": "filename"}]},
                priority=1,
            ),
        ]
        ctx = _ctx()
        result = await run_hooks(HookTrigger.post_transfer, ctx, hooks)
        assert result.action == HookAction.proceed
        assert "experiment" in result.metadata_updates


class TestPostTransferAccessGrants:
    @pytest.mark.asyncio
    async def test_merges_access_grants(self):
        hooks = [
            _make_hook_config(
                "access", HookTrigger.post_transfer, "access_assignment",
                config={"grants": [
                    {"grantee_type": "user", "match_field": "user-id-1", "source": "literal"},
                ]},
                priority=0,
            ),
            _make_hook_config(
                "enrich", HookTrigger.post_transfer, "metadata_enrichment",
                config={"rules": [{"pattern": r"(?P<experiment>exp_\d+)", "source": "path"}]},
                priority=1,
            ),
        ]
        ctx = _ctx()
        result = await run_hooks(HookTrigger.post_transfer, ctx, hooks)
        assert len(result.access_grants) == 1
        assert result.access_grants[0]["grantee_type"] == "user"
        assert "experiment" in result.metadata_updates


class TestDisabledHooks:
    @pytest.mark.asyncio
    async def test_disabled_hooks_skipped(self):
        hooks = [
            _make_hook_config(
                "filter", HookTrigger.pre_transfer, "file_filter",
                config={"exclude_patterns": ["*.tmp"]}, priority=0, enabled=False,
            ),
        ]
        result = await run_hooks(HookTrigger.pre_transfer, _ctx(), hooks)
        assert result.action == HookAction.proceed


class TestTriggerFiltering:
    @pytest.mark.asyncio
    async def test_ignores_wrong_trigger(self):
        hooks = [
            _make_hook_config(
                "filter", HookTrigger.post_transfer, "file_filter",
                config={"exclude_patterns": ["*.tmp"]}, priority=0,
            ),
        ]
        result = await run_hooks(HookTrigger.pre_transfer, _ctx(), hooks)
        assert result.action == HookAction.proceed

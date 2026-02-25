"""Tests for the hook registry."""

import pytest

from app.hooks.builtin.access_assignment import AccessAssignmentHook
from app.hooks.builtin.metadata_enrichment import MetadataEnrichmentHook
from app.hooks.registry import get_hook
from app.models.hook import HookConfig, HookImplementation, HookTrigger


def _make_hook_config(builtin_name: str, implementation=HookImplementation.builtin):
    return HookConfig(
        name="Test Hook",
        trigger=HookTrigger.pre_transfer,
        implementation=implementation,
        builtin_name=builtin_name,
        config={},
        priority=0,
        enabled=True,
    )


class TestGetHook:
    def test_get_file_filter_hook(self):
        config = _make_hook_config("file_filter")
        hook = get_hook(config)
        from app.hooks.builtin.file_filter import FileFilterHook

        assert isinstance(hook, FileFilterHook)

    def test_get_metadata_enrichment_hook(self):
        config = _make_hook_config("metadata_enrichment")
        hook = get_hook(config)
        assert isinstance(hook, MetadataEnrichmentHook)

    def test_get_access_assignment_hook(self):
        config = _make_hook_config("access_assignment")
        hook = get_hook(config)
        assert isinstance(hook, AccessAssignmentHook)

    def test_unknown_builtin_raises(self):
        """Unknown builtin_name raises ValueError (covers line 23)."""
        config = _make_hook_config("nonexistent_hook")
        with pytest.raises(ValueError, match="Unknown builtin hook"):
            get_hook(config)

    def test_non_builtin_implementation_raises(self):
        """Non-builtin implementation raises NotImplementedError (covers line 26)."""
        config = HookConfig(
            name="External Hook",
            trigger=HookTrigger.post_transfer,
            implementation=HookImplementation.http_webhook,
            config={},
            priority=0,
            enabled=True,
        )
        with pytest.raises(NotImplementedError, match="not yet supported"):
            get_hook(config)

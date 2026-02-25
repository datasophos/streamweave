"""Hook registry — maps builtin names to hook classes."""

from __future__ import annotations

from app.hooks.base import BaseHook
from app.hooks.builtin.access_assignment import AccessAssignmentHook
from app.hooks.builtin.file_filter import FileFilterHook
from app.hooks.builtin.metadata_enrichment import MetadataEnrichmentHook
from app.models.hook import HookConfig

BUILTIN_HOOKS: dict[str, type[BaseHook]] = {
    "file_filter": FileFilterHook,
    "metadata_enrichment": MetadataEnrichmentHook,
    "access_assignment": AccessAssignmentHook,
}


def get_hook(hook_config: HookConfig) -> BaseHook:
    """Instantiate a hook from a HookConfig model."""
    if hook_config.implementation.value == "builtin":
        name = hook_config.builtin_name
        if name not in BUILTIN_HOOKS:
            raise ValueError(f"Unknown builtin hook: {name}")
        return BUILTIN_HOOKS[name](config=hook_config.config or {})

    raise NotImplementedError(
        f"Hook implementation '{hook_config.implementation}' not yet supported"
    )

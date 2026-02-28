"""Hook registry — maps builtin names to hook classes."""

from __future__ import annotations

from dataclasses import dataclass

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


@dataclass
class HookMeta:
    name: str
    display_name: str
    description: str
    trigger: str  # "pre", "post", or "both"
    config_schema: dict


BUILTIN_HOOK_META: dict[str, HookMeta] = {
    "file_filter": HookMeta(
        name="file_filter",
        display_name="File Filter",
        description=(
            "Filter files based on include/exclude fnmatch patterns. "
            "Supports redirect rules to send matched files to an alternate path."
        ),
        trigger="pre",
        config_schema={
            "type": "object",
            "properties": {
                "exclude_patterns": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "fnmatch patterns; matched files are skipped",
                },
                "include_patterns": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "If set, only matching files proceed",
                },
                "redirect_rules": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "pattern": {"type": "string"},
                            "destination": {"type": "string"},
                        },
                    },
                    "description": "Redirect files matching pattern to destination path",
                },
            },
        },
    ),
    "metadata_enrichment": HookMeta(
        name="metadata_enrichment",
        display_name="Metadata Enrichment",
        description=(
            "Extract metadata from file paths or filenames using regex named groups. "
            "Captured groups are added to the file's metadata."
        ),
        trigger="post",
        config_schema={
            "type": "object",
            "properties": {
                "rules": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "pattern": {
                                "type": "string",
                                "description": "Regex with named groups",
                            },
                            "source": {
                                "type": "string",
                                "enum": ["filename", "path"],
                                "description": "Match against filename or full path",
                            },
                        },
                    },
                }
            },
        },
    ),
    "access_assignment": HookMeta(
        name="access_assignment",
        display_name="Access Assignment",
        description=(
            "Automatically assign file access grants to users, groups, or projects "
            "based on metadata values or literal IDs."
        ),
        trigger="post",
        config_schema={
            "type": "object",
            "properties": {
                "grants": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "grantee_type": {
                                "type": "string",
                                "enum": ["user", "group", "project"],
                            },
                            "match_field": {"type": "string"},
                            "source": {
                                "type": "string",
                                "enum": ["metadata", "literal"],
                            },
                        },
                    },
                }
            },
        },
    ),
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

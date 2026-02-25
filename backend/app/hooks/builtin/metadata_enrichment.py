"""Post-transfer hook for extracting metadata from file paths via regex."""

from __future__ import annotations

import re

from app.hooks.base import BaseHook, HookAction, HookContext, HookResult


class MetadataEnrichmentHook(BaseHook):
    """Extract metadata from filename/path using regex patterns.

    Config:
        rules: list[dict] — each rule has:
            - pattern: str — regex with named groups
            - source: str — "filename" or "path" (default: "path")
    """

    async def execute(self, context: HookContext) -> HookResult:
        metadata_updates: dict[str, str] = {}

        for rule in self.config.get("rules", []):
            pattern = rule.get("pattern", "")
            source = rule.get("source", "path")
            if not pattern:
                continue

            text = context.source_path if source == "path" else context.filename
            match = re.search(pattern, text)
            if match:
                metadata_updates.update(match.groupdict())

        return HookResult(
            action=HookAction.proceed,
            metadata_updates=metadata_updates,
        )

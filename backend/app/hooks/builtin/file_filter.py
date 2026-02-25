"""Pre-transfer hook for file filtering based on fnmatch patterns."""

from __future__ import annotations

import fnmatch

from app.hooks.base import BaseHook, HookAction, HookContext, HookResult


class FileFilterHook(BaseHook):
    """Filter files based on include/exclude patterns.

    Config:
        exclude_patterns: list[str] — fnmatch patterns; matched files are skipped
        include_patterns: list[str] — fnmatch patterns; if set, only matching files proceed
        redirect_rules: list[dict] — [{"pattern": "*.raw", "destination": "/alt/path"}]
    """

    async def execute(self, context: HookContext) -> HookResult:
        filename = context.filename
        source_path = context.source_path

        # Check redirect rules first
        for rule in self.config.get("redirect_rules", []):
            pattern = rule.get("pattern", "")
            dest = rule.get("destination", "")
            if pattern and dest and (
                fnmatch.fnmatch(filename, pattern) or fnmatch.fnmatch(source_path, pattern)
            ):
                return HookResult(
                    action=HookAction.redirect,
                    redirect_path=dest,
                    message=f"Redirected by pattern '{pattern}'",
                )

        # Check exclude patterns
        for pattern in self.config.get("exclude_patterns", []):
            if fnmatch.fnmatch(filename, pattern) or fnmatch.fnmatch(source_path, pattern):
                return HookResult(
                    action=HookAction.skip,
                    message=f"Excluded by pattern '{pattern}'",
                )

        # Check include patterns (if set, file must match at least one)
        include_patterns = self.config.get("include_patterns", [])
        if include_patterns:
            for pattern in include_patterns:
                if fnmatch.fnmatch(filename, pattern) or fnmatch.fnmatch(source_path, pattern):
                    return HookResult(action=HookAction.proceed)
            return HookResult(
                action=HookAction.skip,
                message="Not matched by any include pattern",
            )

        return HookResult(action=HookAction.proceed)

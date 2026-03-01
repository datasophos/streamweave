"""Tests for the file_filter builtin hook."""

import pytest

from app.hooks.base import HookAction, HookContext
from app.hooks.builtin.file_filter import FileFilterHook


def _ctx(filename: str, source_path: str = "", size_bytes: int = 1024) -> HookContext:
    return HookContext(
        source_path=source_path or filename,
        filename=filename,
        instrument_id="test-id",
        instrument_name="test",
        size_bytes=size_bytes,
    )


class TestExcludePatterns:
    @pytest.mark.asyncio
    async def test_excludes_matching_file(self):
        hook = FileFilterHook(config={"exclude_patterns": ["*.tmp"]})
        result = await hook.execute(_ctx("data.tmp"))
        assert result.action == HookAction.skip

    @pytest.mark.asyncio
    async def test_allows_non_matching_file(self):
        hook = FileFilterHook(config={"exclude_patterns": ["*.tmp"]})
        result = await hook.execute(_ctx("image.tif"))
        assert result.action == HookAction.proceed

    @pytest.mark.asyncio
    async def test_excludes_by_path_pattern(self):
        hook = FileFilterHook(config={"exclude_patterns": ["temp/*"]})
        result = await hook.execute(_ctx("data.txt", "temp/data.txt"))
        assert result.action == HookAction.skip


class TestIncludePatterns:
    @pytest.mark.asyncio
    async def test_includes_matching_file(self):
        hook = FileFilterHook(config={"include_patterns": ["*.tif", "*.raw"]})
        result = await hook.execute(_ctx("image.tif"))
        assert result.action == HookAction.proceed

    @pytest.mark.asyncio
    async def test_skips_non_matching_file(self):
        hook = FileFilterHook(config={"include_patterns": ["*.tif"]})
        result = await hook.execute(_ctx("notes.txt"))
        assert result.action == HookAction.skip


class TestRedirectRules:
    @pytest.mark.asyncio
    async def test_redirect_by_pattern(self):
        hook = FileFilterHook(
            config={
                "redirect_rules": [
                    {"pattern": "*.raw", "destination": "/storage/restricted"},
                ]
            }
        )
        result = await hook.execute(_ctx("sample.raw"))
        assert result.action == HookAction.redirect
        assert result.redirect_path == "/storage/restricted"

    @pytest.mark.asyncio
    async def test_redirect_takes_priority_over_exclude(self):
        hook = FileFilterHook(
            config={
                "redirect_rules": [
                    {"pattern": "*.raw", "destination": "/alt"},
                ],
                "exclude_patterns": ["*.raw"],
            }
        )
        result = await hook.execute(_ctx("sample.raw"))
        assert result.action == HookAction.redirect


class TestMinSizeBytes:
    @pytest.mark.asyncio
    async def test_skips_zero_byte_file(self):
        hook = FileFilterHook(config={"min_size_bytes": 1})
        result = await hook.execute(_ctx("empty.dat", size_bytes=0))
        assert result.action == HookAction.skip

    @pytest.mark.asyncio
    async def test_skips_file_below_minimum(self):
        hook = FileFilterHook(config={"min_size_bytes": 100})
        result = await hook.execute(_ctx("small.dat", size_bytes=50))
        assert result.action == HookAction.skip

    @pytest.mark.asyncio
    async def test_allows_file_at_minimum(self):
        hook = FileFilterHook(config={"min_size_bytes": 100})
        result = await hook.execute(_ctx("ok.dat", size_bytes=100))
        assert result.action == HookAction.proceed

    @pytest.mark.asyncio
    async def test_no_min_size_allows_zero_byte(self):
        hook = FileFilterHook(config={})
        result = await hook.execute(_ctx("empty.dat", size_bytes=0))
        assert result.action == HookAction.proceed

    @pytest.mark.asyncio
    async def test_min_size_checked_before_patterns(self):
        """min_size_bytes fires before exclude_patterns; both reasons to skip are independent."""
        hook = FileFilterHook(config={"min_size_bytes": 1, "exclude_patterns": ["*.tmp"]})
        result = await hook.execute(_ctx("empty.tmp", size_bytes=0))
        assert result.action == HookAction.skip
        assert "0 B" in result.message


class TestNoConfig:
    @pytest.mark.asyncio
    async def test_proceeds_with_empty_config(self):
        hook = FileFilterHook(config={})
        result = await hook.execute(_ctx("anything.txt"))
        assert result.action == HookAction.proceed

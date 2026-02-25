"""Tests for the metadata_enrichment builtin hook."""

import pytest

from app.hooks.base import HookAction, HookContext
from app.hooks.builtin.metadata_enrichment import MetadataEnrichmentHook


def _ctx(source_path: str, filename: str = "") -> HookContext:
    return HookContext(
        source_path=source_path,
        filename=filename or source_path.split("/")[-1],
        instrument_id="test-id",
        instrument_name="test",
    )


class TestRegexExtraction:
    @pytest.mark.asyncio
    async def test_extracts_from_path(self):
        hook = MetadataEnrichmentHook(
            config={
                "rules": [
                    {"pattern": r"(?P<experiment>exp_\d+)/(?P<run>run_\d+)", "source": "path"},
                ]
            }
        )
        result = await hook.execute(_ctx("exp_001/run_042/image.tif"))
        assert result.action == HookAction.proceed
        assert result.metadata_updates == {"experiment": "exp_001", "run": "run_042"}

    @pytest.mark.asyncio
    async def test_extracts_from_filename(self):
        hook = MetadataEnrichmentHook(
            config={
                "rules": [
                    {"pattern": r"(?P<sample>S\d+)_(?P<replicate>R\d+)", "source": "filename"},
                ]
            }
        )
        result = await hook.execute(_ctx("data/S042_R03_scan.tif", "S042_R03_scan.tif"))
        assert result.metadata_updates == {"sample": "S042", "replicate": "R03"}

    @pytest.mark.asyncio
    async def test_no_match_returns_empty(self):
        hook = MetadataEnrichmentHook(
            config={
                "rules": [
                    {"pattern": r"(?P<experiment>exp_\d+)", "source": "path"},
                ]
            }
        )
        result = await hook.execute(_ctx("random/file.tif"))
        assert result.metadata_updates == {}

    @pytest.mark.asyncio
    async def test_multiple_rules_merge(self):
        hook = MetadataEnrichmentHook(
            config={
                "rules": [
                    {"pattern": r"(?P<experiment>exp_\d+)", "source": "path"},
                    {"pattern": r"(?P<channel>ch\d+)", "source": "filename"},
                ]
            }
        )
        result = await hook.execute(_ctx("exp_001/ch2_img.tif", "ch2_img.tif"))
        assert result.metadata_updates == {"experiment": "exp_001", "channel": "ch2"}

    @pytest.mark.asyncio
    async def test_empty_config(self):
        hook = MetadataEnrichmentHook(config={})
        result = await hook.execute(_ctx("file.tif"))
        assert result.metadata_updates == {}

"""Tests for app.services.db — standalone async session factory for Prefect flows."""

import pytest


class TestGetDbSession:
    @pytest.mark.asyncio
    async def test_yields_session(self):
        """get_db_session yields a usable session that commits on success."""
        from sqlalchemy import text

        from app.services.db import get_db_session

        async with get_db_session() as session:
            # Should be a usable session — run a trivial query
            result = await session.execute(text("SELECT 1"))
            row = result.scalar()
            assert row == 1

    @pytest.mark.asyncio
    async def test_rollback_on_exception(self):
        """get_db_session rolls back and re-raises on exception."""
        from app.services.db import get_db_session

        with pytest.raises(ValueError, match="test error"):
            async with get_db_session() as session:  # noqa: F841
                raise ValueError("test error")

    @pytest.mark.asyncio
    async def test_multiple_sessions_independent(self):
        """Two concurrent sessions don't interfere."""
        from sqlalchemy import text

        from app.services.db import get_db_session

        async with get_db_session() as s1, get_db_session() as s2:
            r1 = await s1.execute(text("SELECT 1"))
            r2 = await s2.execute(text("SELECT 2"))
            assert r1.scalar() == 1
            assert r2.scalar() == 2

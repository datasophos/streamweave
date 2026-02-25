"""Tests for app.database and app.main infrastructure."""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch


async def test_get_async_session_yields_session():
    """Cover database.py:12-13 — get_async_session is normally overridden in tests."""
    import app.database as db_module

    mock_session = AsyncMock()

    @asynccontextmanager
    async def mock_factory():
        yield mock_session

    with patch.object(db_module, "async_session_factory", side_effect=mock_factory):
        collected = []
        async for session in db_module.get_async_session():
            collected.append(session)

    assert collected == [mock_session]


async def test_lifespan_executes():
    """Cover main.py:20 — the lifespan yield runs during startup/shutdown."""
    from app.main import create_app, lifespan

    app = create_app()
    async with lifespan(app):
        pass  # line 20 (yield) is hit here

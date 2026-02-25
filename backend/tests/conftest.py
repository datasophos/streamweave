from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from cryptography.fernet import Fernet
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.database import get_async_session
from app.models import Base
from app.models.user import User, UserRole

# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionFactory = async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture(scope="session", autouse=True)
def _set_test_encryption_key():
    """Set a valid Fernet key for tests."""
    key = Fernet.generate_key().decode()
    settings.streamweave_encryption_key = key


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionFactory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    from app.main import app

    async def override_get_session():
        yield db_session

    app.dependency_overrides[get_async_session] = override_get_session

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    from fastapi_users.db import SQLAlchemyUserDatabase

    from app.auth.setup import UserManager
    from app.schemas.user import UserCreate

    user_db = SQLAlchemyUserDatabase(db_session, User)
    user_manager = UserManager(user_db)

    user = await user_manager.create(
        UserCreate(
            email="admin@test.com",
            password="testpassword123",
            role=UserRole.admin,
            is_superuser=True,
        )
    )
    return user


@pytest_asyncio.fixture
async def admin_token(client: AsyncClient, admin_user: User) -> str:
    response = await client.post(
        "/auth/jwt/login",
        data={"username": "admin@test.com", "password": "testpassword123"},
    )
    return response.json()["access_token"]


@pytest.fixture
def admin_headers(admin_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}


@pytest_asyncio.fixture
async def regular_user(db_session: AsyncSession) -> User:
    from fastapi_users.db import SQLAlchemyUserDatabase

    from app.auth.setup import UserManager
    from app.schemas.user import UserCreate

    user_db = SQLAlchemyUserDatabase(db_session, User)
    user_manager = UserManager(user_db)

    user = await user_manager.create(
        UserCreate(
            email="user@test.com",
            password="testpassword123",
            role=UserRole.user,
            is_superuser=False,
        )
    )
    return user


@pytest_asyncio.fixture
async def regular_token(client: AsyncClient, regular_user: User) -> str:
    response = await client.post(
        "/auth/jwt/login",
        data={"username": "user@test.com", "password": "testpassword123"},
    )
    return response.json()["access_token"]


@pytest.fixture
def regular_headers(regular_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {regular_token}"}


@pytest_asyncio.fixture
async def user_instrument_access(db_session: AsyncSession, regular_user: User):
    """Factory fixture: call with (instrument_id) to grant access.
    Legacy fixture — kept for backward compat but prefer grant_file_access.
    """
    from app.models.user import UserInstrumentAccess

    async def _grant(instrument_id):
        access = UserInstrumentAccess(
            user_id=regular_user.id,
            instrument_id=instrument_id,
        )
        db_session.add(access)
        await db_session.flush()
        return access

    return _grant


@pytest_asyncio.fixture
async def grant_file_access(db_session: AsyncSession, regular_user: User):
    """Factory fixture: call with (file_id) to grant user-level file access."""
    from app.models.access import FileAccessGrant, GranteeType

    async def _grant(file_id):
        grant = FileAccessGrant(
            file_id=file_id,
            grantee_type=GranteeType.user,
            grantee_id=regular_user.id,
        )
        db_session.add(grant)
        await db_session.flush()
        return grant

    return _grant

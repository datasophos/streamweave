import uuid

from fastapi import Depends, Request
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin
from fastapi_users.password import PasswordHelper
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    CookieTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_async_session
from app.models.user import User


async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    yield SQLAlchemyUserDatabase(session, User)


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = settings.secret_key
    verification_token_secret = settings.secret_key

    async def on_after_register(self, user: User, request: Request | None = None):
        from fastapi_users.jwt import generate_jwt

        from app.services.email import send_email

        # Generate a verification token directly so we can send welcome + verify in one email.
        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "aud": self.verification_token_audience,
        }
        token = generate_jwt(
            token_data,
            self.verification_token_secret,
            self.verification_token_lifetime_seconds,
        )
        frontend_url = "http://localhost:3000"
        verify_url = f"{frontend_url}/verify-email?token={token}"
        await send_email(
            user.email,
            "Welcome to StreamWeave — verify your email",
            f"<p>Welcome to StreamWeave!</p>"
            f"<p>Click the link below to verify your email address:</p>"
            f'<p><a href="{verify_url}">{verify_url}</a></p>'
            f"<p>This link expires in 24 hours.</p>",
        )

    async def on_after_request_verify(self, user: User, token: str, request: Request | None = None):
        """Standalone re-verification flow (user requests a new link)."""
        from app.services.email import send_email

        frontend_url = "http://localhost:3000"
        verify_url = f"{frontend_url}/verify-email?token={token}"
        await send_email(
            user.email,
            "Verify your StreamWeave account",
            f"<p>Click the link below to verify your email address:</p>"
            f'<p><a href="{verify_url}">{verify_url}</a></p>'
            f"<p>This link expires in 24 hours.</p>",
        )

    async def on_after_forgot_password(
        self, user: User, token: str, request: Request | None = None
    ):
        from app.services.email import send_email

        frontend_url = "http://localhost:3000"
        reset_url = f"{frontend_url}/reset-password?token={token}"
        await send_email(
            user.email,
            "Reset your StreamWeave password",
            f"<p>Click the link below to reset your password:</p>"
            f'<p><a href="{reset_url}">{reset_url}</a></p>'
            f"<p>This link expires in 1 hour. If you didn't request a reset, ignore this email.</p>",
        )


_password_helper = PasswordHelper(
    PasswordHash([Argon2Hasher(), BcryptHasher(rounds=settings.bcrypt_rounds)])
)


async def get_user_manager(user_db=Depends(get_user_db)):
    yield UserManager(user_db, _password_helper)


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=settings.secret_key, lifetime_seconds=settings.jwt_lifetime_seconds)


bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

cookie_transport = CookieTransport(
    cookie_name="streamweave_auth",
    cookie_max_age=settings.jwt_lifetime_seconds,
    cookie_httponly=True,
    cookie_secure=settings.cookie_secure,
    cookie_samesite="lax",
)

cookie_auth_backend = AuthenticationBackend(
    name="cookie",
    transport=cookie_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend, cookie_auth_backend])

current_active_user = fastapi_users.current_user(active=True)
current_superuser = fastapi_users.current_user(active=True, superuser=True)

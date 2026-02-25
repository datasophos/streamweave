#!/usr/bin/env python3
"""Create the first admin user for Streamweave."""

import argparse
import asyncio
import getpass
import sys

from app.config import settings  # noqa: E402
from app.database import async_session_factory, engine  # noqa: E402
from app.models import Base  # noqa: E402


async def create_admin(email: str, password: str):
    # Import here to avoid circular imports
    from app.auth.setup import get_user_db, get_user_manager
    from app.models.user import UserRole
    from app.schemas.user import UserCreate
    from fastapi_users.exceptions import UserAlreadyExists

    async with async_session_factory() as session:
        user_db = SQLAlchemyUserDatabase(session, User)
        user_manager = UserManager(user_db)

        try:
            user = await user_manager.create(
                UserCreate(email=email, password=password, role=UserRole.admin, is_superuser=True)
            )
            print(f"Admin user created: {user.email} (id={user.id})")
        except UserAlreadyExists:
            print(f"User {email} already exists.")
            sys.exit(1)


async def main(email: str | None = None, password: str | None = None):
    if email is None:
        email = input("Admin email: ").strip()
    if not email:
        print("Email is required.")
        sys.exit(1)

    if password is None:
        password = getpass.getpass("Admin password: ")
        if len(password) < 8:
            print("Password must be at least 8 characters.")
            sys.exit(1)
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Passwords do not match.")
            sys.exit(1)
    elif len(password) < 8:
        print("Password must be at least 8 characters.")
        sys.exit(1)

    await create_admin(email, password)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a Streamweave admin user.")
    parser.add_argument("--email", help="Admin email address")
    parser.add_argument("--password", help="Admin password (min 8 characters)")
    args = parser.parse_args()

    # Must be run from backend/ directory
    sys.path.insert(0, ".")
    from app.auth.setup import UserManager
    from app.models.user import User
    from fastapi_users.db import SQLAlchemyUserDatabase

    asyncio.run(main(email=args.email, password=args.password))

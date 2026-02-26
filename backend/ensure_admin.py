#!/usr/bin/env python3
"""Ensure a default admin user exists. Reads credentials from env vars.

Used by the dev Docker Compose stack to seed an admin on first boot.
Safe to re-run — exits 0 if the user already exists.

Required env vars:
  ADMIN_EMAIL     — admin account email
  ADMIN_PASSWORD  — admin account password (min 8 chars)
"""

import asyncio
import os
import sys


async def main() -> None:
    email = os.environ.get("ADMIN_EMAIL", "").strip()
    password = os.environ.get("ADMIN_PASSWORD", "").strip()

    if not email or not password:
        print("ensure_admin: ADMIN_EMAIL and ADMIN_PASSWORD must be set — skipping.")
        return

    from fastapi_users.db import SQLAlchemyUserDatabase
    from fastapi_users.exceptions import UserAlreadyExists

    from app.auth.setup import UserManager
    from app.database import async_session_factory
    from app.models.user import User, UserRole
    from app.schemas.user import UserCreate

    async with async_session_factory() as session:
        user_db = SQLAlchemyUserDatabase(session, User)
        user_manager = UserManager(user_db)
        try:
            user = await user_manager.create(
                UserCreate(
                    email=email,
                    password=password,
                    role=UserRole.admin,
                    is_superuser=True,
                )
            )
            print(f"ensure_admin: created admin user {user.email} (id={user.id})")
        except UserAlreadyExists:
            print(f"ensure_admin: user {email} already exists — skipping.")


if __name__ == "__main__":
    sys.path.insert(0, ".")
    asyncio.run(main())

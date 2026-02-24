from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.setup import current_active_user
from app.database import get_async_session
from app.models.user import User, UserRole


async def get_db(session: AsyncSession = Depends(get_async_session)) -> AsyncSession:
    return session


async def require_admin(user: User = Depends(current_active_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user

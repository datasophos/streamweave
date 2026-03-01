from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.setup import fastapi_users
from app.models.user import User, UserRole

router = APIRouter(tags=["auth"])

current_user_optional = fastapi_users.current_user(active=True, optional=True)


@router.get("/api/auth/check-admin")
async def check_admin(
    user: User | None = Depends(current_user_optional),
) -> dict[str, str]:
    """Return 200 if the caller has admin role; used by Caddy forward_auth.

    Accepts both Bearer token (API calls) and the streamweave_auth cookie
    (browser navigations, e.g. to the Prefect dashboard).
    """
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return {"email": user.email}

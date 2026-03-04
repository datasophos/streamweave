"""Shared pagination utilities for list endpoints."""

from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    skip: int
    limit: int


class PaginationParams:
    def __init__(
        self,
        skip: int = Query(0, ge=0),
        limit: int = Query(25, ge=1, le=500),
    ):
        self.skip = skip
        self.limit = limit


async def paginate(
    db: AsyncSession,
    stmt,
    params: PaginationParams,
) -> PaginatedResponse:
    """Run a COUNT and a paged SELECT against the same filtered statement."""
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()
    paged_result = await db.execute(stmt.offset(params.skip).limit(params.limit))
    items = list(paged_result.scalars().all())
    return PaginatedResponse(items=items, total=total, skip=params.skip, limit=params.limit)

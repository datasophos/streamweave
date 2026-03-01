import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.audit import AuditAction
from app.models.group import Group, GroupMembership
from app.models.user import User
from app.schemas.group import (
    GroupCreate,
    GroupMemberAdd,
    GroupMemberRead,
    GroupRead,
    GroupUpdate,
)
from app.services.audit import log_action

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("", response_model=list[GroupRead])
async def list_groups(
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(Group)
    if not include_deleted:
        stmt = stmt.where(Group.deleted_at.is_(None))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=GroupRead, status_code=status.HTTP_201_CREATED)
async def create_group(
    data: GroupCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    group = Group(**data.model_dump())
    db.add(group)
    await db.flush()
    await log_action(db, "group", group.id, AuditAction.create, actor)
    await db.commit()
    await db.refresh(group)
    return group


@router.get("/{group_id}", response_model=GroupRead)
async def get_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    group = await db.get(Group, group_id)
    if not group or group.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.patch("/{group_id}", response_model=GroupRead)
async def update_group(
    group_id: uuid.UUID,
    data: GroupUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    group = await db.get(Group, group_id)
    if not group or group.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Group not found")
    changes: dict = {}
    for key, value in data.model_dump(exclude_unset=True).items():
        before = getattr(group, key)
        setattr(group, key, value)
        changes[key] = {"before": before, "after": value}
    await log_action(db, "group", group.id, AuditAction.update, actor, changes)
    await db.commit()
    await db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    group = await db.get(Group, group_id)
    if not group or group.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Group not found")
    group.deleted_at = datetime.now(UTC)
    await log_action(db, "group", group.id, AuditAction.delete, actor)
    await db.commit()


@router.post("/{group_id}/restore", response_model=GroupRead)
async def restore_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    group = await db.get(Group, group_id)
    if not group or group.deleted_at is None:
        raise HTTPException(status_code=404, detail="Deleted group not found")
    group.deleted_at = None
    await log_action(db, "group", group.id, AuditAction.restore, actor)
    await db.commit()
    await db.refresh(group)
    return group


@router.get("/{group_id}/members", response_model=list[GroupMemberRead])
async def list_group_members(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    result = await db.execute(select(GroupMembership).where(GroupMembership.group_id == group_id))
    memberships = result.scalars().all()
    user_ids = [m.user_id for m in memberships]
    if user_ids:
        user_rows = await db.execute(select(User).where(User.id.in_(user_ids)))  # type: ignore[attr-defined]
        email_by_id = {u.id: u.email for u in user_rows.scalars()}
    else:
        email_by_id = {}
    return [
        GroupMemberRead(group_id=m.group_id, user_id=m.user_id, email=email_by_id[m.user_id])
        for m in memberships
    ]


@router.post(
    "/{group_id}/members",
    response_model=GroupMemberRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_group_member(
    group_id: uuid.UUID,
    data: GroupMemberAdd,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    user = await db.get(User, data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check for duplicate
    existing = await db.get(GroupMembership, (group_id, data.user_id))
    if existing:
        raise HTTPException(status_code=409, detail="User already in group")

    membership = GroupMembership(group_id=group_id, user_id=data.user_id)
    db.add(membership)
    await db.commit()
    return GroupMemberRead(group_id=group_id, user_id=data.user_id, email=user.email)


@router.delete(
    "/{group_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_group_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    membership = await db.get(GroupMembership, (group_id, user_id))
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    await db.delete(membership)
    await db.commit()

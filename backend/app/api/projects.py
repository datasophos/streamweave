import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.audit import AuditAction
from app.models.project import MemberType, Project, ProjectMembership
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectMemberAdd,
    ProjectMemberRead,
    ProjectRead,
    ProjectUpdate,
)
from app.services.audit import log_action

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(Project)
    if not include_deleted:
        stmt = stmt.where(Project.deleted_at.is_(None))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    project = Project(**data.model_dump())
    db.add(project)
    await db.flush()
    await log_action(db, "project", project.id, AuditAction.create, actor)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    project = await db.get(Project, project_id)
    if not project or project.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: uuid.UUID,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    project = await db.get(Project, project_id)
    if not project or project.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Project not found")
    changes: dict = {}
    for key, value in data.model_dump(exclude_unset=True).items():
        before = getattr(project, key)
        setattr(project, key, value)
        changes[key] = {"before": before, "after": value}
    await log_action(db, "project", project.id, AuditAction.update, actor, changes)
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    project = await db.get(Project, project_id)
    if not project or project.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Project not found")
    project.deleted_at = datetime.now(UTC)
    await log_action(db, "project", project.id, AuditAction.delete, actor)
    await db.commit()


@router.post("/{project_id}/restore", response_model=ProjectRead)
async def restore_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    project = await db.get(Project, project_id)
    if not project or project.deleted_at is None:
        raise HTTPException(status_code=404, detail="Deleted project not found")
    project.deleted_at = None
    await log_action(db, "project", project.id, AuditAction.restore, actor)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}/members", response_model=list[ProjectMemberRead])
async def list_project_members(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    result = await db.execute(
        select(ProjectMembership).where(ProjectMembership.project_id == project_id)
    )
    memberships = result.scalars().all()

    user_ids = [m.member_id for m in memberships if m.member_type == MemberType.user]
    if user_ids:
        user_rows = await db.execute(select(User).where(User.id.in_(user_ids)))  # type: ignore[attr-defined]
        email_by_id = {u.id: u.email for u in user_rows.scalars()}
    else:
        email_by_id = {}

    return [
        ProjectMemberRead(
            id=m.id,
            project_id=m.project_id,
            member_type=m.member_type,
            member_id=m.member_id,
            email=email_by_id.get(m.member_id),
        )
        for m in memberships
    ]


@router.post(
    "/{project_id}/members",
    response_model=ProjectMemberRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_project_member(
    project_id: uuid.UUID,
    data: ProjectMemberAdd,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check for duplicate
    existing = await db.execute(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id,
            ProjectMembership.member_type == data.member_type,
            ProjectMembership.member_id == data.member_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Member already in project")

    membership = ProjectMembership(
        project_id=project_id,
        member_type=data.member_type,
        member_id=data.member_id,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(membership)

    email = None
    if data.member_type == MemberType.user:
        user = await db.get(User, data.member_id)
        if user:
            email = user.email

    return ProjectMemberRead(
        id=membership.id,
        project_id=membership.project_id,
        member_type=membership.member_type,
        member_id=membership.member_id,
        email=email,
    )


@router.delete(
    "/{project_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_project_member(
    project_id: uuid.UUID,
    member_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id,
            ProjectMembership.member_id == member_id,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    await db.delete(membership)
    await db.commit()

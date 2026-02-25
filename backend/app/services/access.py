"""Reusable access-control query helpers for file visibility."""

from __future__ import annotations

from sqlalchemy import or_, select, union_all

from app.models.access import FileAccessGrant, GranteeType
from app.models.file import FileRecord
from app.models.group import GroupMembership
from app.models.project import MemberType, ProjectMembership
from app.models.user import User, UserRole


def accessible_file_ids(user: User):
    """Return a subquery of FileRecord.id values the user can access.

    A non-admin user can see a file if ANY of:
    1. They are the owner_id
    2. A grant with grantee_type=user targets them
    3. A grant with grantee_type=group targets a group they belong to
    4. A grant with grantee_type=project targets a project they belong to
       (directly as user, or via a group)
    """
    user_groups = select(GroupMembership.group_id).where(GroupMembership.user_id == user.id)

    user_projects_direct = select(ProjectMembership.project_id).where(
        ProjectMembership.member_type == MemberType.user,
        ProjectMembership.member_id == user.id,
    )
    user_projects_via_group = select(ProjectMembership.project_id).where(
        ProjectMembership.member_type == MemberType.group,
        ProjectMembership.member_id.in_(user_groups),
    )
    user_projects = union_all(user_projects_direct, user_projects_via_group)

    granted_file_ids = select(FileAccessGrant.file_id).where(
        or_(
            (FileAccessGrant.grantee_type == GranteeType.user)
            & (FileAccessGrant.grantee_id == user.id),
            (FileAccessGrant.grantee_type == GranteeType.group)
            & (FileAccessGrant.grantee_id.in_(user_groups)),
            (FileAccessGrant.grantee_type == GranteeType.project)
            & (FileAccessGrant.grantee_id.in_(user_projects)),
        )
    )

    return granted_file_ids


def apply_file_access_filter(query, user: User):
    """Filter a FileRecord query to only include files the user can access."""
    if user.role == UserRole.admin:
        return query

    return query.where(
        or_(
            FileRecord.owner_id == user.id,
            FileRecord.id.in_(accessible_file_ids(user)),
        )
    )

"""Post-transfer hook for automatically assigning file access based on metadata."""

from __future__ import annotations

from app.hooks.base import BaseHook, HookAction, HookContext, HookResult


class AccessAssignmentHook(BaseHook):
    """Assign file access grants based on metadata values.

    Config:
        grants: list[dict] — each grant rule has:
            - grantee_type: str — "user", "group", or "project"
            - match_field: str — metadata key (source=metadata) or literal ID (source=literal)
            - source: str — "metadata" (resolve match_field from metadata_updates)
                           or "literal" (match_field is the actual grantee_id)

    When source is "metadata", the hook outputs access_grants with the resolved
    name/value — the harvest flow is responsible for resolving names to UUIDs.
    """

    async def execute(self, context: HookContext) -> HookResult:
        access_grants: list[dict] = []

        for rule in self.config.get("grants", []):
            grantee_type = rule.get("grantee_type", "")
            match_field = rule.get("match_field", "")
            source = rule.get("source", "metadata")

            if not grantee_type or not match_field:
                continue

            if source == "literal":
                access_grants.append(
                    {
                        "grantee_type": grantee_type,
                        "grantee_id": match_field,
                    }
                )
            elif source == "metadata":
                # Look up the value from context metadata
                value = context.metadata.get(match_field)
                if value:
                    access_grants.append(
                        {
                            "grantee_type": grantee_type,
                            "resolve_field": match_field,
                            "resolve_value": value,
                        }
                    )

        return HookResult(
            action=HookAction.proceed,
            access_grants=access_grants,
        )

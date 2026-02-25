"""Hook runner — executes hooks in priority order with short-circuit logic."""

from __future__ import annotations

import logging

from app.hooks.base import HookAction, HookContext, HookResult
from app.hooks.registry import get_hook
from app.models.hook import HookConfig, HookTrigger

logger = logging.getLogger(__name__)


async def run_hooks(
    trigger: HookTrigger,
    context: HookContext,
    hook_configs: list[HookConfig],
) -> HookResult:
    """Run hooks matching the trigger in priority order.

    Pre-transfer: first skip/redirect short-circuits.
    Post-transfer: all hooks run; metadata_updates are merged.
    """
    relevant = sorted(
        [h for h in hook_configs if h.trigger == trigger and h.enabled],
        key=lambda h: h.priority,
    )

    merged_metadata: dict = {}
    merged_access_grants: list[dict] = []
    final_result = HookResult(action=HookAction.proceed)

    for hook_config in relevant:
        try:
            hook = get_hook(hook_config)
            result = await hook.execute(context)
        except Exception:
            logger.exception("Hook '%s' failed", hook_config.name)
            continue

        if trigger == HookTrigger.pre_transfer:
            if result.action == HookAction.skip:
                return result
            if result.action == HookAction.redirect:
                return result
            merged_metadata.update(result.metadata_updates)
        else:
            # Post-transfer: merge metadata and access grants, continue
            merged_metadata.update(result.metadata_updates)
            merged_access_grants.extend(result.access_grants)

    final_result.metadata_updates = merged_metadata
    final_result.access_grants = merged_access_grants
    return final_result

"""Base classes and types for the hook system."""

from __future__ import annotations

import abc
import enum
from dataclasses import dataclass, field


class HookAction(enum.StrEnum):
    proceed = "proceed"
    skip = "skip"
    redirect = "redirect"


@dataclass
class HookContext:
    """Context passed to hooks during execution."""

    source_path: str
    filename: str
    instrument_id: str
    instrument_name: str
    size_bytes: int = 0
    metadata: dict = field(default_factory=dict)
    destination_path: str = ""
    transfer_success: bool = False
    checksum: str = ""


@dataclass
class HookResult:
    """Result returned by a hook execution."""

    action: HookAction = HookAction.proceed
    metadata_updates: dict = field(default_factory=dict)
    access_grants: list[dict] = field(default_factory=list)
    redirect_path: str = ""
    message: str = ""


class BaseHook(abc.ABC):
    """Abstract base class for hooks."""

    def __init__(self, config: dict | None = None):
        self.config = config or {}

    @abc.abstractmethod
    async def execute(self, context: HookContext) -> HookResult:
        """Execute the hook and return a result."""

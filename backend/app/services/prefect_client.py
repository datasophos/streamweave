"""Prefect client service for managing deployments and triggering harvests."""

from __future__ import annotations

import logging
import uuid

from app.config import settings

logger = logging.getLogger(__name__)


class PrefectClientService:
    """Wraps the Prefect Python client for deployment management."""

    def __init__(self, api_url: str | None = None):
        self.api_url = api_url or settings.prefect_api_url

    async def create_deployment(
        self,
        *,
        instrument_id: str,
        instrument_name: str,
        schedule_id: str,
        cron_expression: str,
        enabled: bool = True,
    ) -> str | None:
        """Create a Prefect deployment for a harvest schedule. Returns deployment ID."""
        try:
            from prefect.client.orchestration import get_client

            async with get_client() as client:
                from prefect.client.schemas.actions import DeploymentScheduleCreate
                from prefect.client.schemas.schedules import CronSchedule

                deployment_id = await client.create_deployment(
                    flow_id=await self._ensure_flow(client),
                    name=f"harvest-{instrument_name}",
                    entrypoint="app.flows.harvest:harvest_instrument_flow",
                    parameters={
                        "instrument_id": instrument_id,
                        "schedule_id": schedule_id,
                    },
                    tags=[f"instrument:{instrument_name}"],
                    schedules=[
                        DeploymentScheduleCreate(
                            schedule=CronSchedule(cron=cron_expression),
                            active=enabled,
                        )
                    ],
                    work_pool_name="streamweave-worker-pool",
                    path="/app",  # code is pre-installed on the worker
                    pull_steps=[],
                )
                logger.info("Created Prefect deployment %s", deployment_id)
                return str(deployment_id)
        except Exception:
            logger.exception("Failed to create Prefect deployment")
            return None

    async def update_deployment(
        self,
        deployment_id: str,
        *,
        cron_expression: str | None = None,
        enabled: bool | None = None,
    ) -> bool:
        """Update a Prefect deployment schedule. Returns True on success."""
        try:
            from prefect.client.orchestration import get_client
            from prefect.client.schemas.actions import (
                DeploymentScheduleUpdate,
                DeploymentUpdate,
            )
            from prefect.client.schemas.schedules import CronSchedule

            async with get_client() as client:
                dep_uuid = uuid.UUID(deployment_id)

                if cron_expression is None and enabled is None:
                    return True

                # Read current deployment to preserve values
                deployment = await client.read_deployment(dep_uuid)
                current_cron = cron_expression
                current_active = enabled if enabled is not None else True

                if current_cron is None and deployment.schedules:
                    current_cron = getattr(deployment.schedules[0].schedule, "cron", "*/15 * * * *")

                update = DeploymentUpdate(
                    schedules=[
                        DeploymentScheduleUpdate(
                            schedule=CronSchedule(cron=current_cron or "*/15 * * * *"),
                            active=current_active,
                        )
                    ]
                )
                await client.update_deployment(dep_uuid, update)
                logger.info("Updated Prefect deployment %s", deployment_id)
                return True
        except Exception:
            logger.exception("Failed to update Prefect deployment %s", deployment_id)
            return False

    async def delete_deployment(self, deployment_id: str) -> bool:
        """Delete a Prefect deployment. Returns True on success."""
        try:
            from prefect.client.orchestration import get_client

            async with get_client() as client:
                await client.delete_deployment(uuid.UUID(deployment_id))
                logger.info("Deleted Prefect deployment %s", deployment_id)
                return True
        except Exception:
            logger.exception("Failed to delete Prefect deployment %s", deployment_id)
            return False

    async def trigger_harvest(
        self, deployment_id: str, parameters: dict | None = None
    ) -> str | None:
        """Trigger a manual harvest run. Returns flow_run_id."""
        try:
            from prefect.client.orchestration import get_client

            async with get_client() as client:
                flow_run = await client.create_flow_run_from_deployment(
                    uuid.UUID(deployment_id),
                    parameters=parameters,
                )
                logger.info("Triggered harvest run %s", flow_run.id)
                return str(flow_run.id)
        except Exception:
            logger.exception("Failed to trigger harvest for deployment %s", deployment_id)
            return None

    async def _ensure_flow(self, client) -> uuid.UUID:
        """Ensure the harvest-instrument flow is registered and return its ID."""
        # Import the flow to ensure it's registered
        from app.flows.harvest import harvest_instrument_flow

        flow_id = await client.create_flow(harvest_instrument_flow)  # type: ignore[arg-type]
        return flow_id

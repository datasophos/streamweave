"""Tests for PrefectClientService — mocks out the Prefect Python client."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.prefect_client import PrefectClientService


def _fake_deployment_id():
    return uuid.uuid4()


def _make_mock_client(deployment_id=None, flow_id=None, flow_run_id=None):
    """Build an async context-manager mock for get_client()."""
    mock_client = AsyncMock()

    if deployment_id is not None:
        mock_client.create_deployment.return_value = deployment_id
    if flow_id is not None:
        mock_client.create_flow.return_value = flow_id
    if flow_run_id is not None:
        flow_run = MagicMock()
        flow_run.id = flow_run_id
        mock_client.create_flow_run_from_deployment.return_value = flow_run

    # Make the client work as an async context manager
    cm = AsyncMock()
    cm.__aenter__.return_value = mock_client
    cm.__aexit__.return_value = None
    return cm, mock_client


class TestCreateDeployment:
    @pytest.mark.asyncio
    async def test_create_deployment_success(self):
        dep_id = _fake_deployment_id()
        flow_id = _fake_deployment_id()
        cm, mock_client = _make_mock_client(deployment_id=dep_id, flow_id=flow_id)

        with (
            patch("app.services.prefect_client.settings") as mock_settings,
            patch("app.flows.harvest.harvest_instrument_flow"),
            patch(
                "app.services.prefect_client.PrefectClientService._ensure_flow",
                new_callable=AsyncMock,
                return_value=flow_id,
            ),
            patch("prefect.client.orchestration.get_client", return_value=cm),
        ):
            mock_settings.prefect_api_url = "http://localhost:4200/api"
            svc = PrefectClientService()
            result = await svc.create_deployment(
                instrument_id="abc",
                instrument_name="Test Instrument",
                schedule_id="def",
                cron_expression="*/15 * * * *",
                enabled=True,
            )
        assert result == str(dep_id)

    @pytest.mark.asyncio
    async def test_create_deployment_exception_returns_none(self):
        """Exception during create_deployment returns None."""
        with patch(
            "prefect.client.orchestration.get_client",
            side_effect=Exception("Prefect connection refused"),
        ):
            svc = PrefectClientService()
            result = await svc.create_deployment(
                instrument_id="abc",
                instrument_name="Test",
                schedule_id="def",
                cron_expression="*/15 * * * *",
                enabled=True,
            )
        assert result is None


class TestUpdateDeployment:
    @pytest.mark.asyncio
    async def test_update_deployment_success(self):
        dep_id = str(_fake_deployment_id())
        cm, mock_client = _make_mock_client()

        # Mock read_deployment to return a deployment with no schedules
        deployment_mock = MagicMock()
        deployment_mock.schedules = []
        mock_client.read_deployment.return_value = deployment_mock

        with patch(
            "prefect.client.orchestration.get_client",
            return_value=cm,
        ):
            svc = PrefectClientService()
            result = await svc.update_deployment(
                dep_id,
                cron_expression="0 * * * *",
                enabled=True,
            )
        assert result is True

    @pytest.mark.asyncio
    async def test_update_deployment_no_changes_returns_true(self):
        """When both cron_expression and enabled are None, returns True immediately."""
        dep_id = str(_fake_deployment_id())
        cm, mock_client = _make_mock_client()

        with patch(
            "prefect.client.orchestration.get_client",
            return_value=cm,
        ):
            svc = PrefectClientService()
            result = await svc.update_deployment(
                dep_id,
                cron_expression=None,
                enabled=None,
            )
        assert result is True

    @pytest.mark.asyncio
    async def test_update_deployment_uses_existing_cron(self):
        """When cron_expression is None but deployment has a schedule, preserves it."""
        dep_id = str(_fake_deployment_id())
        cm, mock_client = _make_mock_client()

        # Mock deployment with existing schedule
        schedule_mock = MagicMock()
        schedule_mock.schedule.cron = "*/30 * * * *"
        deployment_mock = MagicMock()
        deployment_mock.schedules = [schedule_mock]
        mock_client.read_deployment.return_value = deployment_mock

        with patch(
            "prefect.client.orchestration.get_client",
            return_value=cm,
        ):
            svc = PrefectClientService()
            result = await svc.update_deployment(
                dep_id,
                cron_expression=None,
                enabled=False,
            )
        assert result is True

    @pytest.mark.asyncio
    async def test_update_deployment_exception_returns_false(self):
        """Exception during update returns False."""
        dep_id = str(_fake_deployment_id())

        with patch(
            "prefect.client.orchestration.get_client",
            side_effect=Exception("Prefect down"),
        ):
            svc = PrefectClientService()
            result = await svc.update_deployment(dep_id, cron_expression="0 * * * *")
        assert result is False


class TestDeleteDeployment:
    @pytest.mark.asyncio
    async def test_delete_deployment_success(self):
        dep_id = str(_fake_deployment_id())
        cm, mock_client = _make_mock_client()

        with patch(
            "prefect.client.orchestration.get_client",
            return_value=cm,
        ):
            svc = PrefectClientService()
            result = await svc.delete_deployment(dep_id)
        assert result is True
        mock_client.delete_deployment.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_delete_deployment_exception_returns_false(self):
        dep_id = str(_fake_deployment_id())

        with patch(
            "prefect.client.orchestration.get_client",
            side_effect=Exception("Prefect unavailable"),
        ):
            svc = PrefectClientService()
            result = await svc.delete_deployment(dep_id)
        assert result is False


class TestTriggerHarvest:
    @pytest.mark.asyncio
    async def test_trigger_harvest_success(self):
        dep_id = str(_fake_deployment_id())
        flow_run_id = _fake_deployment_id()
        cm, mock_client = _make_mock_client(flow_run_id=flow_run_id)

        with patch(
            "prefect.client.orchestration.get_client",
            return_value=cm,
        ):
            svc = PrefectClientService()
            result = await svc.trigger_harvest(
                dep_id,
                parameters={"instrument_id": "abc", "schedule_id": "def"},
            )
        assert result == str(flow_run_id)

    @pytest.mark.asyncio
    async def test_trigger_harvest_no_parameters(self):
        dep_id = str(_fake_deployment_id())
        flow_run_id = _fake_deployment_id()
        cm, mock_client = _make_mock_client(flow_run_id=flow_run_id)

        with patch(
            "prefect.client.orchestration.get_client",
            return_value=cm,
        ):
            svc = PrefectClientService()
            result = await svc.trigger_harvest(dep_id)
        assert result == str(flow_run_id)

    @pytest.mark.asyncio
    async def test_trigger_harvest_exception_returns_none(self):
        dep_id = str(_fake_deployment_id())

        with patch(
            "prefect.client.orchestration.get_client",
            side_effect=Exception("Cannot connect"),
        ):
            svc = PrefectClientService()
            result = await svc.trigger_harvest(dep_id)
        assert result is None


class TestEnsureFlow:
    @pytest.mark.asyncio
    async def test_ensure_flow_calls_create_flow(self):
        """_ensure_flow registers the flow and returns its ID."""
        flow_id = _fake_deployment_id()
        mock_client = AsyncMock()
        mock_client.create_flow.return_value = flow_id

        svc = PrefectClientService()
        result = await svc._ensure_flow(mock_client)
        assert result == flow_id
        mock_client.create_flow.assert_awaited_once()


class TestPrefectClientInit:
    def test_default_api_url(self):
        """Uses settings.prefect_api_url by default."""
        from app.config import settings

        svc = PrefectClientService()
        assert svc.api_url == settings.prefect_api_url

    def test_custom_api_url(self):
        """Custom api_url is used when provided."""
        svc = PrefectClientService(api_url="http://custom:4200/api")
        assert svc.api_url == "http://custom:4200/api"

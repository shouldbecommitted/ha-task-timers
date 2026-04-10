"""REST API views backing the Task Timers admin panel."""

from __future__ import annotations

import logging
from http import HTTPStatus
from typing import Any

from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .coordinator import TaskTimersCoordinator
from .storage import TaskTimersStorage
from .timer_manager import Timer, TimerManager

_LOGGER = logging.getLogger(__name__)


def _serialize_timer(timer: Timer) -> dict[str, Any]:
    """Serialize a Timer to JSON-safe dict for the admin panel."""
    next_due_iso = timer.next_due.isoformat()
    return {
        "id": timer.id,
        "name": timer.name,
        "type": timer.timer_type,
        "next_due": next_due_iso,
        # For one-time timers, next_due IS the due date — expose it as due_at
        # too so the edit form can populate its datetime picker directly.
        "due_at": next_due_iso if timer.timer_type == "one_time" else None,
        "remaining_seconds": int(timer.remaining.total_seconds()),
        "is_expired": timer.is_expired,
        "is_warning": timer.is_warning,
        "warning_days": timer.warning_days,
        "last_reset": timer.last_reset.isoformat() if timer.last_reset else None,
        "interval_days": timer.data.get("interval_days", 0),
        "interval_hours": timer.data.get("interval_hours", 0),
        "cron_pattern": timer.data.get("cron_pattern"),
        "tags": timer.data.get("tags", []),
    }


class _TaskTimersBaseView(HomeAssistantView):
    """Base class — gives subclasses access to the integration's state."""

    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        """Hold a reference to hass so subclasses can look up state on demand."""
        self.hass = hass

    @property
    def _coordinator(self) -> TaskTimersCoordinator:
        return self.hass.data[DOMAIN]["coordinator"]

    @property
    def _timer_manager(self) -> TimerManager:
        return self.hass.data[DOMAIN]["timer_manager"]

    @property
    def _storage(self) -> TaskTimersStorage:
        return self.hass.data[DOMAIN]["storage"]


class TaskTimersListView(_TaskTimersBaseView):
    """GET /api/task_timers/list — return all active timers."""

    url = "/api/task_timers/list"
    name = "api:task_timers:list"

    async def get(self, request: web.Request) -> web.Response:
        timers = [_serialize_timer(t) for t in self._timer_manager.list_timers()]
        return self.json({"timers": timers})


class TaskTimersCreateView(_TaskTimersBaseView):
    """POST /api/task_timers/create — create a new timer."""

    url = "/api/task_timers/create"
    name = "api:task_timers:create"

    async def post(self, request: web.Request) -> web.Response:
        try:
            payload = await request.json()
        except ValueError:
            return self.json_message("Invalid JSON body", HTTPStatus.BAD_REQUEST)

        name = (payload.get("name") or "").strip()
        if not name:
            return self.json_message("'name' is required", HTTPStatus.BAD_REQUEST)

        timer_type = payload.get("type") or "recurring"
        if timer_type not in ("one_time", "recurring"):
            return self.json_message(
                "'type' must be 'one_time' or 'recurring'", HTTPStatus.BAD_REQUEST
            )

        kwargs = _clean_schedule_kwargs(payload, timer_type)

        try:
            timer = self._timer_manager.create_timer(name, timer_type, **kwargs)
        except ValueError as err:
            return self.json_message(str(err), HTTPStatus.BAD_REQUEST)
        await self._storage.async_save()
        return self.json(_serialize_timer(timer))


class TaskTimersUpdateView(_TaskTimersBaseView):
    """POST /api/task_timers/update/{timer_id} — update an existing timer."""

    url = "/api/task_timers/update/{timer_id}"
    name = "api:task_timers:update"

    async def post(self, request: web.Request, timer_id: str) -> web.Response:
        try:
            payload = await request.json()
        except ValueError:
            return self.json_message("Invalid JSON body", HTTPStatus.BAD_REQUEST)

        payload.pop("id", None)
        timer_type = payload.get("type") or (
            self._timer_manager.get_timer(timer_id).timer_type
            if self._timer_manager.get_timer(timer_id)
            else "recurring"
        )
        updates = _clean_schedule_kwargs(payload, timer_type)
        if "name" in payload and payload["name"]:
            updates["name"] = payload["name"].strip()
        if "type" in payload:
            updates["type"] = timer_type

        if not self._timer_manager.update_timer(timer_id, updates):
            return self.json_message("Timer not found", HTTPStatus.NOT_FOUND)

        await self._storage.async_save()
        timer = self._timer_manager.get_timer(timer_id)
        return self.json(_serialize_timer(timer))


class TaskTimersResetView(_TaskTimersBaseView):
    """POST /api/task_timers/reset/{timer_id} — reset a timer."""

    url = "/api/task_timers/reset/{timer_id}"
    name = "api:task_timers:reset"

    async def post(self, request: web.Request, timer_id: str) -> web.Response:
        if not self._timer_manager.reset_timer(timer_id):
            return self.json_message("Timer not found", HTTPStatus.NOT_FOUND)
        await self._storage.async_save()
        self._coordinator.dismiss_notification(timer_id)
        return self.json({"success": True})


class TaskTimersDeleteView(_TaskTimersBaseView):
    """POST /api/task_timers/delete/{timer_id} — delete a timer."""

    url = "/api/task_timers/delete/{timer_id}"
    name = "api:task_timers:delete"

    async def post(self, request: web.Request, timer_id: str) -> web.Response:
        if not self._timer_manager.delete_timer(timer_id):
            return self.json_message("Timer not found", HTTPStatus.NOT_FOUND)
        await self._storage.async_save()
        return self.json({"success": True})


def _clean_schedule_kwargs(payload: dict[str, Any], timer_type: str) -> dict[str, Any]:
    """Strip irrelevant/empty schedule fields from a payload."""
    kwargs: dict[str, Any] = {}

    warning_days = payload.get("warning_days")
    if warning_days not in (None, ""):
        try:
            kwargs["warning_days"] = int(warning_days)
        except (TypeError, ValueError):
            pass

    tags = payload.get("tags")
    if isinstance(tags, list):
        kwargs["tags"] = [str(t).strip() for t in tags if str(t).strip()]

    if timer_type != "recurring":
        # one-time timers carry an absolute due date instead of a schedule
        due_at = (payload.get("due_at") or "").strip()
        if due_at:
            kwargs["due_at"] = due_at
        return kwargs

    interval_days = payload.get("interval_days")
    interval_hours = payload.get("interval_hours")
    cron_pattern = (payload.get("cron_pattern") or "").strip()

    if cron_pattern:
        kwargs["cron_pattern"] = cron_pattern
    else:
        try:
            if interval_days not in (None, ""):
                kwargs["interval_days"] = int(interval_days)
            if interval_hours not in (None, ""):
                kwargs["interval_hours"] = int(interval_hours)
        except (TypeError, ValueError):
            pass

    return kwargs


def register_views(hass: HomeAssistant) -> None:
    """Register all Task Timers HTTP views (idempotent at the HA layer)."""
    hass.http.register_view(TaskTimersListView(hass))
    hass.http.register_view(TaskTimersCreateView(hass))
    hass.http.register_view(TaskTimersUpdateView(hass))
    hass.http.register_view(TaskTimersResetView(hass))
    hass.http.register_view(TaskTimersDeleteView(hass))

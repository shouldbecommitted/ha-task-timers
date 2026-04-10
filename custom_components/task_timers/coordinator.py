"""Coordinator for Task Timers."""

import asyncio
import logging
from datetime import timedelta

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .const import DOMAIN, EVENT_TIMER_EXPIRED, NOTIFY_PERSISTENT
from .storage import TaskTimersStorage
from .timer_manager import Timer, TimerManager

_LOGGER = logging.getLogger(__name__)

_NOTIF_PREFIX = "task_timers_"


def _notif_id(timer_id: str) -> str:
    return f"{_NOTIF_PREFIX}{timer_id}"


class TaskTimersCoordinator(DataUpdateCoordinator):
    """Coordinator for Task Timers."""

    def __init__(
        self,
        hass: HomeAssistant,
        timer_manager: TimerManager,
        storage: TaskTimersStorage,
    ) -> None:
        """Initialize coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(minutes=1),
        )
        self.timer_manager = timer_manager
        self.storage = storage
        # IDs of timers for which an expiry notification has already been sent.
        # Cleared when a timer is reset so it can notify again on next expiry.
        self._notified_ids: set[str] = set()

    async def _async_update_data(self) -> dict:
        """Fetch data from timer manager."""
        timers = self.timer_manager.list_timers()
        now = dt_util.now()

        # Single pass: compute status for each timer and collect expired/warning sets.
        expired_ids: set[str] = set()
        warning_ids: list[str] = []
        newly_expired_timers: list[Timer] = []
        timer_data: list[dict] = []

        for t in timers:
            remaining_sec = (t.next_due - now).total_seconds()
            is_expired = remaining_sec <= 0
            is_warning = 0 < remaining_sec < t.warning_days * 86400

            if is_expired:
                expired_ids.add(t.id)
                if t.id not in self._notified_ids:
                    newly_expired_timers.append(t)
            elif is_warning:
                warning_ids.append(t.id)

            timer_data.append(
                {
                    "id": t.id,
                    "name": t.name,
                    "next_due": t.next_due.isoformat(),
                    "remaining_seconds": int(remaining_sec),
                    "is_expired": is_expired,
                    "is_warning": is_warning,
                    "last_reset": t.last_reset.isoformat() if t.last_reset else None,
                }
            )

        # Fire all pending expiry notifications concurrently.
        if newly_expired_timers:
            await asyncio.gather(
                *(self._async_notify_expired(t) for t in newly_expired_timers)
            )

        self._notified_ids = expired_ids

        return {
            "timers": timer_data,
            "expired_timers": list(expired_ids),
            "warning_timers": warning_ids,
        }

    async def _async_notify_expired(self, timer: Timer) -> None:
        """Create a persistent notification and fire a custom event."""
        _LOGGER.info(
            "Timer expired, firing notification: %s (%s)", timer.name, timer.id
        )

        await self.hass.services.async_call(
            NOTIFY_PERSISTENT,
            "create",
            {
                "notification_id": _notif_id(timer.id),
                "title": f"Task due: {timer.name}",
                "message": (
                    f"**{timer.name}** is overdue. "
                    "Open [Task Timers](/task-timers) to reset it."
                ),
            },
            blocking=False,
        )

        self.hass.bus.async_fire(
            EVENT_TIMER_EXPIRED,
            {
                "timer_id": timer.id,
                "name": timer.name,
                "next_due": timer.next_due.isoformat(),
            },
        )

    def dismiss_notification(self, timer_id: str) -> None:
        """Dismiss the expiry notification for a timer (call after reset)."""
        self._notified_ids.discard(timer_id)
        self.hass.async_create_task(
            self.hass.services.async_call(
                NOTIFY_PERSISTENT,
                "dismiss",
                {"notification_id": _notif_id(timer_id)},
                blocking=False,
            )
        )

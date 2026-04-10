"""Coordinator for Task Timers."""
import logging
from datetime import timedelta

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .const import DOMAIN, EVENT_TIMER_EXPIRED
from .storage import TaskTimersStorage
from .timer_manager import Timer, TimerManager

_LOGGER = logging.getLogger(__name__)

# persistent_notification IDs are prefixed so they're easy to identify/dismiss.
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
        expired_ids = {t.id for t in timers if t.is_expired}

        # Fire notifications only for timers that NEWLY crossed into expired state.
        for timer_id in expired_ids - self._notified_ids:
            timer = self.timer_manager.get_timer(timer_id)
            if timer:
                await self._async_notify_expired(timer)

        self._notified_ids = expired_ids

        return {
            "timers": [
                {
                    "id": t.id,
                    "name": t.name,
                    "next_due": t.next_due.isoformat(),
                    "remaining_seconds": int(t.remaining.total_seconds()),
                    "is_expired": t.is_expired,
                    "is_warning": t.is_warning,
                    "last_reset": t.last_reset.isoformat() if t.last_reset else None,
                }
                for t in timers
            ],
            "expired_timers": list(expired_ids),
            "warning_timers": [t.id for t in timers if t.is_warning],
        }

    async def _async_notify_expired(self, timer: Timer) -> None:
        """Create a persistent notification and fire a custom event."""
        _LOGGER.info("Timer expired, firing notification: %s (%s)", timer.name, timer.id)

        # Persistent notification — visible in HA's bell menu until dismissed.
        await self.hass.services.async_call(
            "persistent_notification",
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

        # Custom event — lets users trigger automations (e.g. mobile push).
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
                "persistent_notification",
                "dismiss",
                {"notification_id": _notif_id(timer_id)},
                blocking=False,
            )
        )

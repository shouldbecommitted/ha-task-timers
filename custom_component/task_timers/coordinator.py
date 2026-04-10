"""Coordinator for Task Timers."""
import logging
from datetime import timedelta

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .const import DOMAIN
from .storage import TaskTimersStorage
from .timer_manager import TimerManager

_LOGGER = logging.getLogger(__name__)


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

    async def _async_update_data(self) -> dict:
        """Fetch data from timer manager."""
        # Check for expired timers and trigger notifications
        expired = self.timer_manager.list_expired_timers()
        warning = self.timer_manager.list_warning_timers()
        
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
                for t in self.timer_manager.list_timers()
            ],
            "expired_timers": [t.id for t in expired],
            "warning_timers": [t.id for t in warning],
        }

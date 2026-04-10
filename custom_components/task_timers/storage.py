"""Storage handler for Task Timers."""

import logging
import uuid
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import STORAGE_KEY, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)


class TaskTimersStorage:
    """Handle storage of task timers."""

    def __init__(self, hass: HomeAssistant):
        """Initialize storage."""
        self.hass = hass
        self.store = Store(hass, STORAGE_VERSION, STORAGE_KEY, atomic_writes=True)
        self.data = {}

    async def async_load(self) -> dict[str, Any]:
        """Load timers from storage."""
        try:
            data = await self.store.async_load()
            if data:
                self.data = data
                _LOGGER.debug(
                    f"Loaded {len(self.data.get('timers', []))} timers from storage"
                )
            else:
                self.data = {"timers": [], "history": []}
                await self.async_save()
        except Exception as err:
            _LOGGER.error(f"Error loading timers: {err}")
            self.data = {"timers": [], "history": []}
        return self.data

    async def async_save(self) -> None:
        """Save timers to storage."""
        try:
            await self.store.async_save(self.data)
            _LOGGER.debug("Timers saved to storage")
        except Exception as err:
            _LOGGER.error(f"Error saving timers: {err}")

    def add_timer(self, timer_config: dict[str, Any]) -> str:
        """Add a new timer and return its ID."""
        timers = self.data.get("timers", [])

        timer_id = str(uuid.uuid4())

        timer = {
            "id": timer_id,
            "created_at": dt_util.now().isoformat(),
            **timer_config,
        }
        timers.append(timer)
        self.data["timers"] = timers
        return timer_id

    def get_timer(self, timer_id: str) -> dict[str, Any] | None:
        """Get a timer by ID."""
        for timer in self.data.get("timers", []):
            if timer["id"] == timer_id:
                return timer
        return None

    def update_timer(self, timer_id: str, updates: dict[str, Any]) -> bool:
        """Update a timer and return success."""
        timers = self.data.get("timers", [])
        for timer in timers:
            if timer["id"] == timer_id:
                timer.update(updates)
                self.data["timers"] = timers
                return True
        return False

    def delete_timer(self, timer_id: str) -> bool:
        """Delete a timer and return success."""
        timers = self.data.get("timers", [])
        self.data["timers"] = [t for t in timers if t["id"] != timer_id]
        return len(self.data["timers"]) < len(timers)

    def list_timers(self) -> list[dict[str, Any]]:
        """Get all timers."""
        return self.data.get("timers", [])

    def add_history_entry(self, timer_id: str, action: str) -> None:
        """Add a history entry for timer action."""
        history = self.data.get("history", [])
        entry = {
            "timer_id": timer_id,
            "action": action,  # 'reset', 'created', 'expired'
            "timestamp": dt_util.now().isoformat(),
        }
        history.append(entry)
        # Keep last 1000 entries
        if len(history) > 1000:
            history = history[-1000:]
        self.data["history"] = history

    def get_timer_history(self, timer_id: str, limit: int = 50) -> list[dict[str, Any]]:
        """Get history entries for a timer."""
        history = self.data.get("history", [])
        timer_history = [h for h in history if h["timer_id"] == timer_id]
        return timer_history[-limit:]

"""Timer manager for Task Timers."""
import logging
from datetime import datetime, timedelta
from typing import Any

from croniter import croniter

from .const import TIMER_ONE_TIME, TIMER_RECURRING
from .storage import TaskTimersStorage

_LOGGER = logging.getLogger(__name__)


class Timer:
    """Represents a single task timer."""

    def __init__(self, timer_data: dict[str, Any]):
        """Initialize timer from storage data."""
        self.data = timer_data

    @property
    def id(self) -> str:
        """Get timer ID."""
        return self.data["id"]

    @property
    def name(self) -> str:
        """Get timer name."""
        return self.data["name"]

    @property
    def timer_type(self) -> str:
        """Get timer type (one_time or recurring)."""
        return self.data.get("type", TIMER_ONE_TIME)

    @property
    def next_due(self) -> datetime:
        """Get next due date/time."""
        return datetime.fromisoformat(self.data.get("next_due"))

    @property
    def last_reset(self) -> datetime | None:
        """Get last reset timestamp."""
        if last_reset_str := self.data.get("last_reset"):
            return datetime.fromisoformat(last_reset_str)
        return None

    @property
    def remaining(self) -> timedelta:
        """Get time remaining until due."""
        return self.next_due - datetime.now()

    @property
    def is_expired(self) -> bool:
        """Check if timer is expired."""
        return self.remaining.total_seconds() <= 0

    @property
    def is_warning(self) -> bool:
        """Check if timer is in warning (expiring soon)."""
        warning_days = self.data.get("warning_days", 7)
        return 0 < self.remaining.total_seconds() < (warning_days * 86400)

    def reset(self, storage: TaskTimersStorage) -> None:
        """Reset the timer to next due date."""
        self.data["last_reset"] = datetime.now().isoformat()
        
        if self.timer_type == TIMER_RECURRING:
            self.data["next_due"] = self._calculate_next_due().isoformat()
        else:
            # One-time timer expires after reset
            self.data["next_due"] = (datetime.now() + timedelta(days=365*100)).isoformat()
        
        storage.update_timer(self.id, self.data)
        storage.add_history_entry(self.id, "reset")

    def _calculate_next_due(self) -> datetime:
        """Calculate next due date based on schedule."""
        now = datetime.now()
        
        # Cron-based scheduling
        if cron_pattern := self.data.get("cron_pattern"):
            try:
                cron = croniter(cron_pattern, now)
                return cron.get_next(datetime)
            except Exception as err:
                _LOGGER.error(f"Invalid cron pattern for {self.name}: {err}")
        
        # Interval-based scheduling
        interval_days = self.data.get("interval_days", 0)
        interval_hours = self.data.get("interval_hours", 0)
        
        if interval_days or interval_hours:
            delta = timedelta(days=interval_days, hours=interval_hours)
            return now + delta
        
        # No schedule found, default to 30 days
        return now + timedelta(days=30)


class TimerManager:
    """Manages all task timers."""

    def __init__(self, hass, storage: TaskTimersStorage):
        """Initialize timer manager."""
        self.hass = hass
        self.storage = storage
        self.timers: dict[str, Timer] = {}

    async def async_load(self) -> None:
        """Load all timers from storage."""
        await self.storage.async_load()
        self.timers.clear()
        
        for timer_data in self.storage.list_timers():
            timer = Timer(timer_data)
            self.timers[timer.id] = timer
        
        _LOGGER.debug(f"Loaded {len(self.timers)} timers")

    async def async_save(self) -> None:
        """Save all timers to storage."""
        await self.storage.async_save()

    def create_timer(self, name: str, timer_type: str, **kwargs) -> Timer:
        """Create and return a new timer."""
        config = {
            "name": name,
            "type": timer_type,
            "next_due": (datetime.now() + timedelta(days=kwargs.get("interval_days", 30))).isoformat(),
            **kwargs,
        }
        
        timer_id = self.storage.add_timer(config)
        timer = Timer(self.storage.get_timer(timer_id))
        self.timers[timer_id] = timer
        self.storage.add_history_entry(timer_id, "created")
        
        _LOGGER.info(f"Created timer: {name} (ID: {timer_id})")
        return timer

    def get_timer(self, timer_id: str) -> Timer | None:
        """Get a timer by ID."""
        return self.timers.get(timer_id)

    def list_timers(self) -> list[Timer]:
        """Get all timers sorted by next due date."""
        return sorted(self.timers.values(), key=lambda t: t.next_due)

    def list_expired_timers(self) -> list[Timer]:
        """Get all expired timers."""
        return [t for t in self.timers.values() if t.is_expired]

    def list_warning_timers(self, days_ahead: int = 7) -> list[Timer]:
        """Get timers expiring within days_ahead."""
        now = datetime.now()
        cutoff = now + timedelta(days=days_ahead)
        
        return [
            t for t in self.timers.values()
            if now < t.next_due <= cutoff
        ]

    def reset_timer(self, timer_id: str) -> bool:
        """Reset timer and return success."""
        if timer := self.get_timer(timer_id):
            timer.reset(self.storage)
            return True
        return False

    def delete_timer(self, timer_id: str) -> bool:
        """Delete a timer and return success."""
        if self.storage.delete_timer(timer_id):
            self.timers.pop(timer_id, None)
            _LOGGER.info(f"Deleted timer: {timer_id}")
            return True
        return False

    def update_timer(self, timer_id: str, updates: dict[str, Any]) -> bool:
        """Update a timer and return success."""
        if timer := self.get_timer(timer_id):
            timer.data.update(updates)
            # Recalculate if schedule changed
            if "cron_pattern" in updates or "interval_days" in updates or "interval_hours" in updates:
                timer.data["next_due"] = timer._calculate_next_due().isoformat()
            self.storage.update_timer(timer_id, timer.data)
            _LOGGER.info(f"Updated timer: {timer.name}")
            return True
        return False

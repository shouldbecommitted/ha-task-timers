"""Sensor platform for Task Timers — exposes each timer as a TIMESTAMP sensor."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, SIGNAL_TIMER_ADDED, SIGNAL_TIMER_REMOVED
from .coordinator import TaskTimersCoordinator
from .timer_manager import Timer, TimerManager

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Task Timers sensor entities and listen for dynamic add/remove."""
    data = hass.data[DOMAIN]
    coordinator: TaskTimersCoordinator = data["coordinator"]
    timer_manager: TimerManager = data["timer_manager"]

    entities_by_id: dict[str, TaskTimerSensor] = {}

    def _build_entities(timer_ids: list[str]) -> list[TaskTimerSensor]:
        new_entities: list[TaskTimerSensor] = []
        for timer_id in timer_ids:
            if timer_id in entities_by_id:
                continue
            timer = timer_manager.get_timer(timer_id)
            if timer is None:
                continue
            entity = TaskTimerSensor(coordinator, timer_id)
            entities_by_id[timer_id] = entity
            new_entities.append(entity)
        return new_entities

    # Initial load
    initial = _build_entities([t.id for t in timer_manager.list_timers()])
    if initial:
        async_add_entities(initial)

    @callback
    def _handle_added(timer_id: str) -> None:
        new_entities = _build_entities([timer_id])
        if new_entities:
            async_add_entities(new_entities)

    @callback
    def _handle_removed(timer_id: str) -> None:
        entity = entities_by_id.pop(timer_id, None)
        if entity is not None:
            hass.async_create_task(entity.async_remove(force_remove=True))

    entry.async_on_unload(
        async_dispatcher_connect(hass, SIGNAL_TIMER_ADDED, _handle_added)
    )
    entry.async_on_unload(
        async_dispatcher_connect(hass, SIGNAL_TIMER_REMOVED, _handle_removed)
    )


class TaskTimerSensor(CoordinatorEntity[TaskTimersCoordinator], SensorEntity):
    """A single task timer exposed as a TIMESTAMP sensor (next due date)."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_icon = "mdi:clipboard-text-clock-outline"
    _attr_has_entity_name = False

    def __init__(self, coordinator: TaskTimersCoordinator, timer_id: str) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._timer_id = timer_id
        self._attr_unique_id = f"{DOMAIN}_{timer_id}"

    @property
    def _timer(self) -> Timer | None:
        return self.coordinator.timer_manager.get_timer(self._timer_id)

    @property
    def available(self) -> bool:
        """Return True if the underlying timer still exists."""
        return self._timer is not None and super().available

    @property
    def name(self) -> str:
        """Return the timer's friendly name."""
        timer = self._timer
        return timer.name if timer else f"Task Timer {self._timer_id}"

    @property
    def native_value(self) -> datetime | None:
        """Return the next due datetime."""
        timer = self._timer
        return timer.next_due if timer else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return extra state attributes for templating in dashboards."""
        timer = self._timer
        if timer is None:
            return {}
        return {
            "timer_id": timer.id,
            "type": timer.timer_type,
            "is_expired": timer.is_expired,
            "is_warning": timer.is_warning,
            "warning_days": timer.warning_days,
            "remaining_seconds": int(timer.remaining.total_seconds()),
            "last_reset": timer.last_reset.isoformat() if timer.last_reset else None,
        }

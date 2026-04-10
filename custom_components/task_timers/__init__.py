"""Task Timers integration setup."""
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, LOGGER, SERVICE_CREATE_TIMER, SERVICE_DELETE_TIMER, SERVICE_RESET_TIMER
from .coordinator import TaskTimersCoordinator
from .storage import TaskTimersStorage
from .timer_manager import TimerManager

PLATFORMS: list[Platform] = [Platform.TIMER]


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Task Timers integration."""
    LOGGER.debug("Setting up Task Timers integration")
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Task Timers from a config entry."""
    LOGGER.debug(f"Setting up Task Timers entry: {entry.entry_id}")
    
    # Initialize storage and timer manager
    storage = TaskTimersStorage(hass)
    await storage.async_load()
    
    timer_manager = TimerManager(hass, storage)
    await timer_manager.async_load()
    
    # Create coordinator
    coordinator = TaskTimersCoordinator(hass, timer_manager, storage)
    await coordinator.async_config_entry_first_refresh()
    
    # Store in hass.data
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN] = {
        "coordinator": coordinator,
        "timer_manager": timer_manager,
        "storage": storage,
    }
    
    # Register services
    await _register_services(hass, timer_manager, storage)
    
    # Forward setup to platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    LOGGER.debug(f"Unloading Task Timers entry: {entry.entry_id}")
    
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    
    if unload_ok:
        hass.data[DOMAIN].clear()
    
    return unload_ok


async def _register_services(
    hass: HomeAssistant, timer_manager: TimerManager, storage: TaskTimersStorage
) -> None:
    """Register Task Timers services."""
    
    async def handle_create_timer(call) -> None:
        """Handle create timer service call."""
        name = call.data.get("name")
        timer_type = call.data.get("type", "one_time")
        kwargs = {k: v for k, v in call.data.items() if k not in ["name", "type"]}
        
        timer = timer_manager.create_timer(name, timer_type, **kwargs)
        await storage.async_save()
        
        LOGGER.info(f"Service: Created timer '{name}'")
    
    async def handle_reset_timer(call) -> None:
        """Handle reset timer service call."""
        timer_id = call.data.get("timer_id")
        
        if timer_manager.reset_timer(timer_id):
            await storage.async_save()
            LOGGER.info(f"Service: Reset timer {timer_id}")
        else:
            LOGGER.warning(f"Service: Timer not found {timer_id}")
    
    async def handle_delete_timer(call) -> None:
        """Handle delete timer service call."""
        timer_id = call.data.get("timer_id")
        
        if timer_manager.delete_timer(timer_id):
            await storage.async_save()
            LOGGER.info(f"Service: Deleted timer {timer_id}")
        else:
            LOGGER.warning(f"Service: Timer not found {timer_id}")
    
    # Register services
    hass.services.async_register(DOMAIN, "create_timer", handle_create_timer)
    hass.services.async_register(DOMAIN, "reset_timer", handle_reset_timer)
    hass.services.async_register(DOMAIN, "delete_timer", handle_delete_timer)
    
    LOGGER.debug("Task Timers services registered")

"""Task Timers integration setup."""
import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, LOGGER, SERVICE_CREATE_TIMER, SERVICE_DELETE_TIMER, SERVICE_RESET_TIMER
from .coordinator import TaskTimersCoordinator
from .storage import TaskTimersStorage
from .timer_manager import TimerManager

PLATFORMS: list[Platform] = [Platform.SENSOR]

CREATE_TIMER_SCHEMA = vol.Schema({
    vol.Required("name"): cv.string,
    vol.Optional("type", default="recurring"): vol.In(["one_time", "recurring"]),
    vol.Optional("interval_days", default=0): vol.Coerce(int),
    vol.Optional("interval_hours", default=0): vol.Coerce(int),
    vol.Optional("cron_pattern"): cv.string,
    vol.Optional("warning_days", default=7): vol.Coerce(int),
})

RESET_TIMER_SCHEMA = vol.Schema({
    vol.Required("timer_id"): cv.string,
})

DELETE_TIMER_SCHEMA = vol.Schema({
    vol.Required("timer_id"): cv.string,
})


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Task Timers integration."""
    LOGGER.debug("Setting up Task Timers integration")
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Task Timers from a config entry."""
    LOGGER.debug(f"Setting up Task Timers entry: {entry.entry_id}")

    # Initialize storage and timer manager
    storage = TaskTimersStorage(hass)

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
    _register_services(hass, timer_manager, storage)

    # Forward to sensor platform — each timer becomes a TIMESTAMP sensor entity
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    LOGGER.debug(f"Unloading Task Timers entry: {entry.entry_id}")
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].clear()
    return unload_ok


def _register_services(
    hass: HomeAssistant, timer_manager: TimerManager, storage: TaskTimersStorage
) -> None:
    """Register Task Timers services."""

    async def handle_create_timer(call) -> None:
        """Handle create timer service call."""
        name = call.data["name"]
        timer_type = call.data.get("type", "recurring")
        kwargs = {k: v for k, v in call.data.items() if k not in ["name", "type"]}

        timer_manager.create_timer(name, timer_type, **kwargs)
        await storage.async_save()
        LOGGER.info(f"Service: Created timer '{name}'")

    async def handle_reset_timer(call) -> None:
        """Handle reset timer service call."""
        timer_id = call.data["timer_id"]

        if timer_manager.reset_timer(timer_id):
            await storage.async_save()
            LOGGER.info(f"Service: Reset timer {timer_id}")
        else:
            LOGGER.warning(f"Service: Timer not found {timer_id}")

    async def handle_delete_timer(call) -> None:
        """Handle delete timer service call."""
        timer_id = call.data["timer_id"]

        if timer_manager.delete_timer(timer_id):
            await storage.async_save()
            LOGGER.info(f"Service: Deleted timer {timer_id}")
        else:
            LOGGER.warning(f"Service: Timer not found {timer_id}")

    hass.services.async_register(DOMAIN, SERVICE_CREATE_TIMER, handle_create_timer, schema=CREATE_TIMER_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_RESET_TIMER, handle_reset_timer, schema=RESET_TIMER_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_DELETE_TIMER, handle_delete_timer, schema=DELETE_TIMER_SCHEMA)

    LOGGER.debug("Task Timers services registered")

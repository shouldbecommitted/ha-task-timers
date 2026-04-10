"""Config flow for Task Timers."""

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN, LOGGER


class TaskTimersConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Task Timers."""

    VERSION = 1
    MINOR_VERSION = 1

    async def async_step_user(self, user_input: dict | None = None) -> FlowResult:
        """Handle the initial step."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(
                title="Task Timers",
                data=user_input,
            )

        # Show simple setup form
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required("name", default="Task Timers"): str,
                }
            ),
            description_placeholders={},
        )

    async def async_step_import(self, import_data: dict) -> FlowResult:
        """Handle import from configuration.yaml."""
        LOGGER.debug("Importing Task Timers from configuration.yaml")
        return await self.async_step_user()

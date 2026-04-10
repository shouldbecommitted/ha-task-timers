"""Task Timers integration for Home Assistant."""
import logging
from typing import Final

DOMAIN: Final = "task_timers"
LOGGER = logging.getLogger(__name__)

# Service names
SERVICE_CREATE_TIMER = "create_timer"
SERVICE_RESET_TIMER = "reset_timer"
SERVICE_DELETE_TIMER = "delete_timer"
SERVICE_LIST_TIMERS = "list_timers"

# Storage version
STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}_data"

# Notification types
NOTIFY_PERSISTENT = "persistent_notification"
NOTIFY_EVENT = "event"
NOTIFY_SERVICE_CALL = "service_call"

# Timer types
TIMER_ONE_TIME = "one_time"
TIMER_RECURRING = "recurring"

# Dispatcher signals
SIGNAL_TIMER_ADDED = f"{DOMAIN}_timer_added"
SIGNAL_TIMER_REMOVED = f"{DOMAIN}_timer_removed"

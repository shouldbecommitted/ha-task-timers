# Dashboard Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the sidebar iframe admin panel with a native Lovelace custom card (summary + full-screen dialog) backed by real-time WebSocket updates.

**Architecture:** Remove sidebar panel from `__init__.py`. Add WebSocket subscription support to `views.py` and dispatcher signals to `timer_manager.py`. Create `www/task-timers-card.js` — a plain `HTMLElement` custom card with summary mode (badge counts + timer list) and dialog mode (full CRUD overlay). Auth is automatic via the `hass` object. No framework, no build step.

**Tech Stack:** Plain `HTMLElement`, HA REST API via `hass.callApi()`, HA WebSocket subscription via `hass.connection`

---

### Task 1: Add dispatcher signal for timer updates

**Files:**
- Modify: `custom_components/task_timers/const.py:29`
- Modify: `custom_components/task_timers/timer_manager.py:215-252`

- [ ] **Step 1: Add `SIGNAL_TIMER_UPDATED` to const.py**

Edit `custom_components/task_timers/const.py` — add after line 29 (`SIGNAL_TIMER_REMOVED`):

```python
SIGNAL_TIMER_UPDATED = f"{DOMAIN}_timer_updated"
```

- [ ] **Step 2: Fire the signal in timer_manager.py reset_timer and update_timer**

Edit `custom_components/task_timers/timer_manager.py` — update the const import (line 12-16) to include `SIGNAL_TIMER_UPDATED`:

```python
from .const import (
    SIGNAL_TIMER_ADDED,
    SIGNAL_TIMER_REMOVED,
    SIGNAL_TIMER_UPDATED,
    TIMER_ONE_TIME,
    TIMER_RECURRING,
)
```

In `reset_timer()` (line 215), add a dispatcher send after `await self.storage.async_save()`:

```python
async def reset_timer(self, timer_id: str) -> bool:
    """Reset timer and return success."""
    if timer := self.get_timer(timer_id):
        timer.reset(self.storage)
        await self.storage.async_save()
        async_dispatcher_send(self.hass, SIGNAL_TIMER_UPDATED, timer_id)
        return True
    return False
```

In `update_timer()` (after `_LOGGER.info` around line 251), add a dispatcher send:

```python
def update_timer(self, timer_id: str, updates: dict[str, Any]) -> bool:
    # ... existing code ...
    self.storage.update_timer(timer_id, timer.data)
    _LOGGER.info(f"Updated timer: {timer.name}")
    async_dispatcher_send(self.hass, SIGNAL_TIMER_UPDATED, timer_id)
    return True
```

- [ ] **Step 3: Commit**

```bash
cd /home/mirage/docker/ha/ha-task-timers
git add custom_components/task_timers/const.py custom_components/task_timers/timer_manager.py
git commit -m "feat: add SIGNAL_TIMER_UPDATED dispatcher for timer updates/resets"
```

---

### Task 2: Add WebSocket handlers to views.py

**Files:**
- Modify: `custom_components/task_timers/views.py`
- Modify: `custom_components/task_timers/__init__.py:23,86-88`

- [ ] **Step 1: Add WebSocket imports to views.py**

At the top of `custom_components/task_timers/views.py`, add:

```python
import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
```

And update the existing `from .const import` block at line 13 to also import the signal constants:

```python
from .const import (
    DOMAIN,
    EVENT_TIMER_EXPIRED,
    SIGNAL_TIMER_ADDED,
    SIGNAL_TIMER_REMOVED,
    SIGNAL_TIMER_UPDATED,
)
```

- [ ] **Step 2: Add WebSocket handlers at bottom of views.py**

Add after the `register_views()` function (after line 212):

```python
def _serialize_all_timers(timer_manager: TimerManager) -> list[dict[str, Any]]:
    return [_serialize_timer(t) for t in timer_manager.list_timers()]


@websocket_api.websocket_command({
    vol.Required("type"): "task_timers/list",
})
@websocket_api.async_response
async def websocket_list_timers(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    timer_manager: TimerManager = hass.data[DOMAIN]["timer_manager"]
    timers = _serialize_all_timers(timer_manager)
    connection.send_result(msg["id"], {"timers": timers})


@websocket_api.websocket_command({
    vol.Required("type"): "task_timers/subscribe",
})
@websocket_api.async_response
async def websocket_subscribe_timers(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    timer_manager: TimerManager = hass.data[DOMAIN]["timer_manager"]

    @callback
    def push_update(*_args: Any) -> None:
        data = {"timers": _serialize_all_timers(timer_manager)}
        connection.send_message(
            {"id": msg["id"], "type": "event", "event": data}
        )

    unsubs = [
        async_dispatcher_connect(hass, SIGNAL_TIMER_ADDED, push_update),
        async_dispatcher_connect(hass, SIGNAL_TIMER_REMOVED, push_update),
        async_dispatcher_connect(hass, SIGNAL_TIMER_UPDATED, push_update),
    ]

    @callback
    def unsubscribe() -> None:
        for unsub in unsubs:
            unsub()

    connection.subscriptions[msg["id"]] = unsubscribe
    connection.send_result(msg["id"])


def register_websocket_handlers(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(
        hass, "task_timers/list", websocket_list_timers,
    )
    websocket_api.async_register_command(hass, websocket_subscribe_timers)
```

- [ ] **Step 3: Register WebSocket handlers from `__init__.py`**

Edit `custom_components/task_timers/__init__.py` line 23:

```python
from .views import register_views, register_websocket_handlers
```

In `async_setup_entry()` after line 88 (`await _async_register_admin_panel(hass)`), add:

```python
    register_websocket_handlers(hass)
```

- [ ] **Step 4: Commit**

```bash
cd /home/mirage/docker/ha/ha-task-timers
git add custom_components/task_timers/views.py custom_components/task_timers/__init__.py
git commit -m "feat: add WebSocket list and subscribe handlers for real-time timer updates"
```

---

### Task 3: Remove sidebar admin panel

**Files:**
- Modify: `custom_components/task_timers/__init__.py`
- Delete: `custom_components/task_timers/www/admin-panel.html`

- [ ] **Step 1: Remove panel-related imports and constants**

In `custom_components/task_timers/__init__.py`:

Remove line 3: `from pathlib import Path`
Remove line 6: `from homeassistant.components import frontend`
Remove line 7: `from homeassistant.components.http import StaticPathConfig`

Remove lines 27-29:
```python
PANEL_URL_PATH = "task-timers"
PANEL_STATIC_URL = f"/{DOMAIN}_panel"
PANEL_FILE = "admin-panel.html"
```

- [ ] **Step 2: Remove `_async_register_admin_panel()` function (lines 96-119)**

Delete the entire function body and its guard clause.

- [ ] **Step 3: Replace the call in `async_setup_entry()`**

After the services registration block (around line 85-88), replace:

```python
    # REST views, static panel assets, and sidebar panel -- once per HA instance
    await _async_register_admin_panel(hass)

    register_websocket_handlers(hass)
```

with:

```python
    # REST views and WebSocket handlers (idempotent)
    register_views(hass)
    register_websocket_handlers(hass)
```

- [ ] **Step 4: Clean up `async_unload_entry()`**

Remove lines that remove the sidebar panel:

```python
        if PANEL_URL_PATH in hass.data.get("frontend_panels", {}):
            frontend.async_remove_panel(hass, PANEL_URL_PATH)
```

- [ ] **Step 5: Delete admin-panel.html**

```bash
rm custom_components/task_timers/www/admin-panel.html
```

- [ ] **Step 6: Commit**

```bash
cd /home/mirage/docker/ha/ha-task-timers
git add -u custom_components/task_timers/
git add custom_components/task_timers/www/
git commit -m "refactor: remove sidebar iframe panel, clean up unused imports"
```

---

### Task 4: Create the custom card JS (skeleton + summary mode)

**Files:**
- Create: `custom_components/task_timers/www/task-timers-card.js`

- [ ] **Step 1: Create the card file**

Write `custom_components/task_timers/www/task-timers-card.js`:

```javascript
class TaskTimersCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = {};
    this._timers = [];
    this._dialog = false;
    this._editing = null;
    this._unsub = null;
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    this._config = config;
  }

  set hass(hass) {
    if (!hass) return;
    const prev = this._hass;
    this._hass = hass;
    if (!prev) this._fetchAndSubscribe();
    this._render();
  }

  getCardSize() {
    return this._timers.length + 2;
  }

  static getStubConfig() {
    return { title: "Task Timers" };
  }

  async _fetchAndSubscribe() {
    try {
      const data = await this._hass.callApi("GET", "task_timers/list");
      this._timers = data.timers || [];
      this._render();
    } catch (err) {
      this._timers = [];
      this._render();
    }
    this._subscribe();
  }

  _subscribe() {
    if (this._unsub) this._unsub();
    this._unsub = this._hass.connection.subscribeMessage(
      (msg) => {
        if (msg.event && msg.event.timers) {
          this._timers = msg.event.timers;
          this._render();
        }
      },
      { type: "task_timers/subscribe" }
    );
  }

  async _deleteTimer(id) {
    if (!confirm("Delete this timer permanently?")) return;
    try {
      await this._hass.callApi("POST", `task_timers/delete/${id}`);
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  }

  async _resetTimer(id) {
    if (!confirm("Reset this timer?")) return;
    try {
      await this._hass.callApi("POST", `task_timers/reset/${id}`);
    } catch (e) {
      alert("Reset failed: " + e.message);
    }
  }

  _render() {
    const root = this.shadowRoot;
    if (!root) return;
    if (this._dialog) {
      root.innerHTML = this._dialogHTML();
      this._bindDialogEvents(root);
    } else {
      root.innerHTML = this._summaryHTML();
      this._bindSummaryEvents(root);
    }
  }

  _summaryHTML() {
    const title = this._config.title || "Task Timers";
    const expired = this._timers.filter(t => t.is_expired);
    const warning = this._timers.filter(t => t.is_warning && !t.is_expired);
    const list = this._timers.map(t => this._timerRowHTML(t)).join("");

    const badgeHTML = (expired.length + warning.length) === 0
      ? ""
      : `<div class="badges">
           ${warning.length ? `<span class="badge-warn">${warning.length}</span>` : ""}
           ${expired.length ? `<span class="badge-exp">${expired.length}</span>` : ""}
         </div>`;

    return `<style>${styles}</style>
      <ha-card>
        <div class="header">
          <span class="title">${title}</span>
          ${badgeHTML}
        </div>
        <div class="list">${list || '<div class="empty">No timers configured</div>'}</div>
        <div class="footer" id="manage-btn">Manage all timers &#x203A;</div>
      </ha-card>`;
  }

  _timerRowHTML(t) {
    const cls = t.is_expired ? "expired" : t.is_warning ? "warning" : "ok";
    const remain = t.is_expired
      ? `Expired ${this._fmtAgo(Math.abs(t.remaining_seconds))} ago`
      : `Due in ${this._fmtRemaining(t.remaining_seconds)}`;
    return `<div class="row ${cls}">
      <span class="dot ${cls}">&#x25CF;</span>
      <span class="name">${this._esc(t.name)}</span>
      <span class="remain">${remain}</span>
    </div>`;
  }

  _esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  _fmtRemaining(sec) {
    if (sec < 0) return this._fmtAgo(Math.abs(sec)) + " ago";
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  _fmtAgo(sec) {
    const d = Math.floor(sec / 86400);
    if (d > 0) return `${d}d`;
    const h = Math.floor(sec / 3600);
    if (h > 0) return `${h}h`;
    return `${Math.floor(sec / 60)}m`;
  }

  _bindSummaryEvents(root) {
    const btn = root.getElementById("manage-btn");
    if (btn) btn.addEventListener("click", () => { this._dialog = true; this._render(); });
  }

  // --- Dialog mode (placeholder -- filled in Task 5) ---
  _dialogHTML() {
    return `<style>${styles} ${dialogStyles}</style>
      <div class="overlay" id="overlay-bg">
        <div class="dialog">
          <div class="d-header">
            <span class="d-title">Task Timers</span>
            <button class="btn-add" id="add-btn">+ Add Timer</button>
            <button class="btn-close" id="close-btn">&times;</button>
          </div>
          <div class="d-grid" id="grid">
            ${this._timers.map(t => this._dialogCardHTML(t)).join("")}
          </div>
          <div id="form-container"></div>
        </div>
      </div>`;
  }

  _dialogCardHTML(t) {
    const c = t.is_expired ? "#c62828" : t.is_warning ? "#ef6c00" : "#2e7d32";
    const status = t.is_expired
      ? `Expired ${this._fmtAgo(Math.abs(t.remaining_seconds))} ago`
      : `Due in ${this._fmtRemaining(t.remaining_seconds)}`;
    const schedule = t.cron_pattern
      ? `cron: ${this._esc(t.cron_pattern)}`
      : t.type === "recurring"
        ? `${t.interval_days || 0}d ${t.interval_hours || 0}h`
        : "one-time";
    return `<div class="tile" style="border-left:3px solid ${c}" data-id="${t.id}">
      <div class="t-name">${this._esc(t.name)}</div>
      <div class="t-meta">${this._esc(t.type)} &middot; ${schedule}</div>
      <div class="t-status" style="color:${c}">${status}</div>
      <div class="t-actions">
        <button class="act" data-action="edit" data-id="${t.id}">Edit</button>
        <button class="act" data-action="reset" data-id="${t.id}">Reset</button>
        <button class="act danger" data-action="delete" data-id="${t.id}">Delete</button>
      </div>
    </div>`;
  }

  _bindDialogEvents(root) {
    root.getElementById("close-btn").addEventListener("click", () => {
      this._dialog = false;
      this._editing = null;
      this._render();
    });
    root.getElementById("overlay-bg").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) {
        this._dialog = false;
        this._editing = null;
        this._render();
      }
    });
    root.getElementById("add-btn").addEventListener("click", () => {
      this._editing = null;
      this._renderForm(root);
    });
    root.getElementById("grid").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === "edit") {
        this._editing = this._timers.find(t => t.id === id);
        this._renderForm(root);
      } else if (btn.dataset.action === "reset") {
        this._resetTimer(id);
      } else if (btn.dataset.action === "delete") {
        this._deleteTimer(id);
      }
    });
  }

  // --- Form (create/edit) ---
  _renderForm(root) {
    const container = root.getElementById("form-container");
    const timer = this._editing || {};
    const title = this._editing ? "Edit Timer" : "Add Timer";
    const type = timer.type || "recurring";
    const isRecurring = type === "recurring";
    container.innerHTML = `<div class="form-overlay" id="form-bg">
      <div class="form-box">
        <div class="f-header">
          <h3>${title}</h3>
          <button class="btn-close" id="form-close">&times;</button>
        </div>
        <div class="f-body">
          <label>Name <input id="f-name" value="${this._esc(timer.name || "")}"/></label>
          <label>Type
            <select id="f-type">
              <option value="recurring" ${!isRecurring ? "" : "selected"}>Recurring</option>
              <option value="one_time" ${isRecurring ? "" : "selected"}>One-time</option>
            </select>
          </label>
          <div id="f-recurring" style="display:${isRecurring ? "block" : "none"}">
            <label>Interval days <input type="number" id="f-days" min="0" value="${timer.interval_days || ""}"/></label>
            <label>Interval hours <input type="number" id="f-hours" min="0" max="23" value="${timer.interval_hours || ""}"/></label>
            <label>Cron pattern (optional) <input id="f-cron" placeholder="0 0 1 * *" value="${timer.cron_pattern || ""}"/></label>
          </div>
          <div id="f-onetime" style="display:${isRecurring ? "none" : "block"}">
            <label>Due at <input type="datetime-local" id="f-due" value="${this._dtLocal(timer.due_at || "")}"/></label>
          </div>
          <label>Warning days <input type="number" id="f-warn" min="0" value="${timer.warning_days ?? 7}"/></label>
        </div>
        <div class="f-actions">
          <button class="btn-save" id="form-save">Save</button>
          <button class="btn-cancel" id="form-cancel">Cancel</button>
        </div>
      </div>
    </div>`;
    container.style.display = "block";

    const typeEl = container.querySelector("#f-type");
    typeEl.addEventListener("change", () => {
      container.querySelector("#f-recurring").style.display = typeEl.value === "recurring" ? "block" : "none";
      container.querySelector("#f-onetime").style.display = typeEl.value === "recurring" ? "none" : "block";
    });
    container.querySelector("#form-close").addEventListener("click", () => { container.innerHTML = ""; container.style.display = "none"; });
    container.querySelector("#form-bg").addEventListener("click", (e) => { if (e.target === e.currentTarget) { container.innerHTML = ""; container.style.display = "none"; } });
    container.querySelector("#form-cancel").addEventListener("click", () => { container.innerHTML = ""; container.style.display = "none"; });
    container.querySelector("#form-save").addEventListener("click", () => this._saveForm(container, root));
  }

  async _saveForm(container, root) {
    const name = container.querySelector("#f-name").value.trim();
    if (!name) { alert("Name is required"); return; }
    const type = container.querySelector("#f-type").value;
    const warning = parseInt(container.querySelector("#f-warn").value, 10) || 7;
    const payload = { name, type, warning_days: warning };
    if (type === "recurring") {
      payload.interval_days = parseInt(container.querySelector("#f-days").value, 10) || 0;
      payload.interval_hours = parseInt(container.querySelector("#f-hours").value, 10) || 0;
      const cron = container.querySelector("#f-cron").value.trim();
      if (cron) payload.cron_pattern = cron;
    } else {
      const dueEl = container.querySelector("#f-due");
      if (!dueEl.value) { alert("Due date is required for one-time timers"); return; }
      payload.due_at = new Date(dueEl.value).toISOString();
    }
    try {
      if (this._editing) {
        await this._hass.callApi("POST", `task_timers/update/${this._editing.id}`, payload);
      } else {
        await this._hass.callApi("POST", "task_timers/create", payload);
      }
    } catch (e) {
      alert("Save failed: " + e.message);
    }
    container.innerHTML = "";
    container.style.display = "none";
    this._editing = null;
  }

  _dtLocal(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}

const styles = `
  ha-card { display: block; background: var(--card-background-color, #fff); border-radius: var(--ha-card-border-radius, 12px); overflow: hidden; }
  .header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--divider-color, #e0e0e0); }
  .title { flex: 1; font-weight: 600; font-size: 1.05em; color: var(--primary-text-color); }
  .badges { display: flex; gap: 6px; }
  .badge-warn { background: var(--warning-color, #fff3e0); color: var(--dark-warning-color, #ef6c00); padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; }
  .badge-exp { background: var(--error-color, #ffcdd2); color: var(--dark-error-color, #c62828); padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; }
  .list { padding: 4px 0; max-height: 300px; overflow-y: auto; }
  .row { display: flex; align-items: center; gap: 8px; padding: 6px 16px; font-size: 0.88em; }
  .row:not(:last-child) { border-bottom: 1px solid var(--divider-color, #f0f0f0); }
  .dot { font-size: 0.7em; flex-shrink: 0; }
  .dot.warning { color: var(--dark-warning-color, #ef6c00); }
  .dot.expired { color: var(--dark-error-color, #c62828); }
  .dot.ok { color: var(--success-color, #2e7d32); }
  .name { flex: 1; color: var(--primary-text-color); }
  .remain { font-weight: 500; font-size: 0.9em; }
  .row.expired .remain { color: var(--dark-error-color, #c62828); }
  .row.warning .remain { color: var(--dark-warning-color, #ef6c00); }
  .row.ok .remain { color: var(--secondary-text-color); }
  .empty { padding: 20px; text-align: center; color: var(--secondary-text-color); font-size: 0.88em; }
  .footer { padding: 8px 16px; border-top: 1px solid var(--divider-color, #e0e0e0); text-align: center; color: var(--primary-color, #1976d2); cursor: pointer; font-size: 0.85em; font-weight: 500; }
  .footer:hover { background: rgba(25,118,210,0.08); }
`;

const dialogStyles = `
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; padding: 20px; overflow-y: auto; }
  .dialog { background: var(--card-background-color, #1c1f24); border-radius: var(--ha-card-border-radius, 12px); max-width: 800px; width: 100%; margin-top: 10vh; margin-bottom: 40px; box-shadow: 0 12px 40px rgba(0,0,0,0.5); }
  .d-header { display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-bottom: 1px solid var(--divider-color, #2a2e35); }
  .d-title { flex: 1; font-weight: 600; font-size: 1.1em; color: var(--primary-text-color); }
  .btn-add { background: var(--primary-color, #1976d2); color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85em; font-weight: 500; }
  .btn-close { background: none; border: none; font-size: 1.4em; color: var(--secondary-text-color); cursor: pointer; padding: 0 4px; line-height: 1; }
  .d-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; padding: 16px 20px; }
  .tile { background: var(--primary-background-color, #2a2e35); border-radius: 8px; padding: 14px; }
  .t-name { font-weight: 600; font-size: 0.95em; color: var(--primary-text-color); margin-bottom: 4px; }
  .t-meta { font-size: 0.8em; color: var(--secondary-text-color); margin-bottom: 6px; }
  .t-status { font-size: 0.82em; font-weight: 500; margin-bottom: 10px; }
  .t-actions { display: flex; gap: 6px; }
  .act { background: var(--divider-color, #3a3e45); color: var(--primary-text-color); border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em; }
  .act.danger { color: var(--dark-error-color, #ef5350); }
  #form-container { display: none; }
  .form-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .form-box { background: var(--card-background-color, #1c1f24); border-radius: var(--ha-card-border-radius, 12px); max-width: 420px; width: 100%; padding: 0; box-shadow: 0 12px 40px rgba(0,0,0,0.5); }
  .f-header { display: flex; align-items: center; padding: 14px 20px; border-bottom: 1px solid var(--divider-color, #2a2e35); }
  .f-header h3 { flex: 1; margin: 0; font-size: 1em; color: var(--primary-text-color); }
  .f-body { padding: 16px 20px; }
  .f-body label { display: block; margin-bottom: 10px; font-size: 0.85em; color: var(--primary-text-color); font-weight: 500; }
  .f-body input, .f-body select { display: block; width: 100%; margin-top: 4px; padding: 8px 10px; border: 1px solid var(--divider-color, #3a3e45); border-radius: 6px; font-size: 0.9em; background: var(--primary-background-color, #1c1f24); color: var(--primary-text-color); box-sizing: border-box; }
  .f-actions { display: flex; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--divider-color, #2a2e35); }
  .f-actions button { flex: 1; padding: 9px 14px; border-radius: 6px; border: none; font-size: 0.9em; font-weight: 500; cursor: pointer; }
  .btn-save { background: var(--primary-color, #1976d2); color: #fff; }
  .btn-cancel { background: var(--divider-color, #3a3e45); color: var(--primary-text-color); }
`;

customElements.define("task-timers-card", TaskTimersCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "task-timers-card",
  name: "Task Timers",
  description: "Maintenance timer summary and management card.",
});
```

- [ ] **Step 2: Commit**

```bash
cd /home/mirage/docker/ha/ha-task-timers
git add custom_components/task_timers/www/task-timers-card.js
git commit -m "feat: create task-timers-card custom Lovelace card"
```

---

### Task 5: Bump version and commit final state

**Files:**
- Modify: `custom_components/task_timers/manifest.json`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump version to 1.4.0**

Edit `custom_components/task_timers/manifest.json`, change `version` from `"1.3.5"` to `"1.4.0"`.

- [ ] **Step 2: Add changelog entry**

Edit `CHANGELOG.md` — add a new section at the top:

```markdown
## [1.4.0] - 2026-05-07

### Added
- Lovelace custom card (`task-timers-card`) for dashboards — shows summary with
  warning/expired badge counts and timer list, with a full-screen management dialog
  for CRUD operations.
- Real-time WebSocket subscription for timer updates (replaces 30s REST polling).
- `SIGNAL_TIMER_UPDATED` dispatcher signal for timer resets/updates.

### Changed
- Replaced sidebar iframe panel with native Lovelace card. The card is placed on
  any dashboard via `type: custom:task-timers-card`.
- Auth is handled automatically via the `hass` object — no manual token extraction.
- Management opens as a full-screen dialog overlay from the summary card.

### Removed
- Sidebar admin panel (`admin-panel.html`) and iframe registration.
```

- [ ] **Step 3: Commit and tag**

```bash
cd /home/mirage/docker/ha/ha-task-timers
git add custom_components/task_timers/manifest.json CHANGELOG.md
git commit -m "Release v1.4.0 — dashboard card with real-time WebSocket updates"
git tag v1.4.0
git push origin main v1.4.0
```

---

### Post-Implementation: Deploy to HA

After pushing the release, deploy the updated integration to the HA instance:

```bash
sudo cp -r /home/mirage/docker/ha/ha-task-timers/custom_components/task_timers/* \
  /home/mirage/docker/ha/config/custom_components/task_timers/
```

Then add the Lovelace resource. In HA Settings > Dashboards > Resources add:

```
url: /hacsfiles/task_timers/task-timers-card.js
type: JavaScript Module
```

Or equivalently, add to `.storage/lovelace_resources` (restart required).

Then restart HA:

```bash
cd /home/mirage/docker/ha
docker compose restart homeassistant
```

After restart, add the card to any dashboard:
```yaml
type: custom:task-timers-card
title: Task Timers
```

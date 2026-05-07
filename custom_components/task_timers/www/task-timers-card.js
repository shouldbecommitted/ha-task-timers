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
    var prev = this._hass;
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
      var data = await this._hass.callApi("GET", "task_timers/list");
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
      function (msg) {
        if (msg.event && msg.event.timers) {
          this._timers = msg.event.timers;
          this._render();
        }
      }.bind(this),
      { type: "task_timers/subscribe" }
    );
  }

  async _deleteTimer(id) {
    if (!confirm("Delete this timer permanently?")) return;
    try {
      await this._hass.callApi("POST", "task_timers/delete/" + id);
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  }

  async _resetTimer(id) {
    if (!confirm("Reset this timer?")) return;
    try {
      await this._hass.callApi("POST", "task_timers/reset/" + id);
    } catch (e) {
      alert("Reset failed: " + e.message);
    }
  }

  _render() {
    var root = this.shadowRoot;
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
    var title = this._config.title || "Task Timers";
    var expired = this._timers.filter(function (t) { return t.is_expired; });
    var warning = this._timers.filter(function (t) { return t.is_warning && !t.is_expired; });
    var list = this._timers.map(this._timerRowHTML.bind(this)).join("");

    var badgeHTML = "";
    if (warning.length || expired.length) {
      badgeHTML = '<div class="badges">';
      if (warning.length) badgeHTML += '<span class="badge-warn">' + warning.length + '</span>';
      if (expired.length) badgeHTML += '<span class="badge-exp">' + expired.length + '</span>';
      badgeHTML += '</div>';
    }

    return '<style>' + styles + '</style>'
      + '<ha-card>'
      + '<div class="header">'
      + '<span class="title">' + this._esc(title) + '</span>'
      + badgeHTML
      + '</div>'
      + '<div class="list">' + (list || '<div class="empty">No timers configured</div>') + '</div>'
      + '<div class="footer" id="manage-btn">Manage all timers &#x203A;</div>'
      + '</ha-card>';
  }

  _timerRowHTML(t) {
    var cls = t.is_expired ? "expired" : t.is_warning ? "warning" : "ok";
    var dot = t.is_expired ? "&#x25CF;" : t.is_warning ? "&#x25CF;" : "&#x25CF;";
    var remain;
    if (t.is_expired) {
      remain = "Expired " + this._fmtAgo(Math.abs(t.remaining_seconds)) + " ago";
    } else {
      remain = "Due in " + this._fmtRemaining(t.remaining_seconds);
    }
    return '<div class="row ' + cls + '">'
      + '<span class="dot ' + cls + '">' + dot + '</span>'
      + '<span class="name">' + this._esc(t.name) + '</span>'
      + '<span class="remain">' + remain + '</span>'
      + '</div>';
  }

  _esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  _fmtRemaining(sec) {
    if (sec < 0) return this._fmtAgo(Math.abs(sec)) + " ago";
    var d = Math.floor(sec / 86400);
    var h = Math.floor((sec % 86400) / 3600);
    var m = Math.floor((sec % 3600) / 60);
    if (d > 0) return d + "d " + h + "h";
    if (h > 0) return h + "h " + m + "m";
    return m + "m";
  }

  _fmtAgo(sec) {
    var d = Math.floor(sec / 86400);
    if (d > 0) return d + "d";
    var h = Math.floor(sec / 3600);
    if (h > 0) return h + "h";
    return Math.floor(sec / 60) + "m";
  }

  _bindSummaryEvents(root) {
    var btn = root.getElementById("manage-btn");
    if (btn) {
      btn.addEventListener("click", function () {
        this._dialog = true;
        this._render();
      }.bind(this));
    }
  }

  _dialogHTML() {
    var self = this;
    var cards = this._timers.map(function (t) { return self._dialogCardHTML(t); }).join("");
    return '<style>' + styles + dialogStyles + '</style>'
      + '<div class="overlay" id="overlay-bg">'
      + '<div class="dialog">'
      + '<div class="d-header">'
      + '<span class="d-title">Task Timers</span>'
      + '<button class="btn-add" id="add-btn">+ Add Timer</button>'
      + '<button class="btn-close" id="close-btn">&times;</button>'
      + '</div>'
      + '<div class="d-grid" id="grid">' + cards + '</div>'
      + '<div id="form-container"></div>'
      + '</div>'
      + '</div>';
  }

  _dialogCardHTML(t) {
    var c = t.is_expired ? "#c62828" : t.is_warning ? "#ef6c00" : "#2e7d32";
    var status;
    if (t.is_expired) {
      status = "Expired " + this._fmtAgo(Math.abs(t.remaining_seconds)) + " ago";
    } else {
      status = "Due in " + this._fmtRemaining(t.remaining_seconds);
    }
    var schedule;
    if (t.cron_pattern) {
      schedule = "cron: " + this._esc(t.cron_pattern);
    } else if (t.type === "recurring") {
      schedule = (t.interval_days || 0) + "d " + (t.interval_hours || 0) + "h";
    } else {
      schedule = "one-time";
    }
    return '<div class="tile" style="border-left:3px solid ' + c + '" data-id="' + t.id + '">'
      + '<div class="t-name">' + this._esc(t.name) + '</div>'
      + '<div class="t-meta">' + this._esc(t.type) + ' &middot; ' + schedule + '</div>'
      + '<div class="t-status" style="color:' + c + '">' + status + '</div>'
      + '<div class="t-actions">'
      + '<button class="act" data-action="edit" data-id="' + t.id + '">Edit</button>'
      + '<button class="act" data-action="reset" data-id="' + t.id + '">Reset</button>'
      + '<button class="act danger" data-action="delete" data-id="' + t.id + '">Delete</button>'
      + '</div>'
      + '</div>';
  }

  _bindDialogEvents(root) {
    var self = this;
    root.getElementById("close-btn").addEventListener("click", function () {
      self._dialog = false;
      self._editing = null;
      self._render();
    });
    root.getElementById("overlay-bg").addEventListener("click", function (e) {
      if (e.target === e.currentTarget) {
        self._dialog = false;
        self._editing = null;
        self._render();
      }
    });
    root.getElementById("add-btn").addEventListener("click", function () {
      self._editing = null;
      self._renderForm(root);
    });
    root.getElementById("grid").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-action]");
      if (!btn) return;
      var id = btn.dataset.id;
      if (btn.dataset.action === "edit") {
        self._editing = self._timers.find(function (t) { return t.id === id; });
        self._renderForm(root);
      } else if (btn.dataset.action === "reset") {
        self._resetTimer(id);
      } else if (btn.dataset.action === "delete") {
        self._deleteTimer(id);
      }
    });
  }

  _renderForm(root) {
    var self = this;
    var container = root.getElementById("form-container");
    var timer = this._editing || {};
    var fTitle = this._editing ? "Edit Timer" : "Add Timer";
    var type = timer.type || "recurring";
    var isRecurring = type === "recurring";

    container.innerHTML = '<div class="form-overlay" id="form-bg">'
      + '<div class="form-box">'
      + '<div class="f-header">'
      + '<h3>' + fTitle + '</h3>'
      + '<button class="btn-close" id="form-close">&times;</button>'
      + '</div>'
      + '<div class="f-body">'
      + '<label>Name <input id="f-name" value="' + self._esc(timer.name || "") + '"/></label>'
      + '<label>Type'
      + '<select id="f-type">'
      + '<option value="recurring"' + (isRecurring ? ' selected' : '') + '>Recurring</option>'
      + '<option value="one_time"' + (isRecurring ? '' : ' selected') + '>One-time</option>'
      + '</select>'
      + '</label>'
      + '<div id="f-recurring" style="display:' + (isRecurring ? 'block' : 'none') + '">'
      + '<label>Interval days <input type="number" id="f-days" min="0" value="' + (timer.interval_days || "") + '"/></label>'
      + '<label>Interval hours <input type="number" id="f-hours" min="0" max="23" value="' + (timer.interval_hours || "") + '"/></label>'
      + '<label>Cron pattern (optional) <input id="f-cron" placeholder="0 0 1 * *" value="' + (timer.cron_pattern || "") + '"/></label>'
      + '</div>'
      + '<div id="f-onetime" style="display:' + (isRecurring ? 'none' : 'block') + '">'
      + '<label>Due at <input type="datetime-local" id="f-due" value="' + self._dtLocal(timer.due_at || "") + '"/></label>'
      + '</div>'
      + '<label>Warning days <input type="number" id="f-warn" min="0" value="' + (timer.warning_days != null ? timer.warning_days : 7) + '"/></label>'
      + '</div>'
      + '<div class="f-actions">'
      + '<button class="btn-save" id="form-save">Save</button>'
      + '<button class="btn-cancel" id="form-cancel">Cancel</button>'
      + '</div>'
      + '</div>'
      + '</div>';
    container.style.display = "block";

    var typeEl = container.querySelector("#f-type");
    typeEl.addEventListener("change", function () {
      container.querySelector("#f-recurring").style.display = typeEl.value === "recurring" ? "block" : "none";
      container.querySelector("#f-onetime").style.display = typeEl.value === "recurring" ? "none" : "block";
    });
    container.querySelector("#form-close").addEventListener("click", function () { container.innerHTML = ""; container.style.display = "none"; });
    container.querySelector("#form-bg").addEventListener("click", function (e) { if (e.target === e.currentTarget) { container.innerHTML = ""; container.style.display = "none"; } });
    container.querySelector("#form-cancel").addEventListener("click", function () { container.innerHTML = ""; container.style.display = "none"; });
    container.querySelector("#form-save").addEventListener("click", function () { self._saveForm(container); });
  }

  async _saveForm(container) {
    var name = container.querySelector("#f-name").value.trim();
    if (!name) { alert("Name is required"); return; }
    var type = container.querySelector("#f-type").value;
    var warning = parseInt(container.querySelector("#f-warn").value, 10) || 7;
    var payload = { name: name, type: type, warning_days: warning };
    if (type === "recurring") {
      payload.interval_days = parseInt(container.querySelector("#f-days").value, 10) || 0;
      payload.interval_hours = parseInt(container.querySelector("#f-hours").value, 10) || 0;
      var cron = container.querySelector("#f-cron").value.trim();
      if (cron) payload.cron_pattern = cron;
    } else {
      var dueEl = container.querySelector("#f-due");
      if (!dueEl.value) { alert("Due date is required for one-time timers"); return; }
      payload.due_at = new Date(dueEl.value).toISOString();
    }
    try {
      if (this._editing) {
        await this._hass.callApi("POST", "task_timers/update/" + this._editing.id, payload);
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
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  }
}

var styles = ''
  + 'ha-card { display: block; background: var(--card-background-color, #fff); border-radius: var(--ha-card-border-radius, 12px); overflow: hidden; }'
  + '.header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--divider-color, #e0e0e0); }'
  + '.title { flex: 1; font-weight: 600; font-size: 1.05em; color: var(--primary-text-color); }'
  + '.badges { display: flex; gap: 6px; }'
  + '.badge-warn { background: var(--warning-color, #fff3e0); color: var(--dark-warning-color, #ef6c00); padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; }'
  + '.badge-exp { background: var(--error-color, #ffcdd2); color: var(--dark-error-color, #c62828); padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; }'
  + '.list { padding: 4px 0; max-height: 300px; overflow-y: auto; }'
  + '.row { display: flex; align-items: center; gap: 8px; padding: 6px 16px; font-size: 0.88em; }'
  + '.row:not(:last-child) { border-bottom: 1px solid var(--divider-color, #f0f0f0); }'
  + '.dot { font-size: 0.7em; flex-shrink: 0; }'
  + '.dot.warning { color: var(--dark-warning-color, #ef6c00); }'
  + '.dot.expired { color: var(--dark-error-color, #c62828); }'
  + '.dot.ok { color: var(--success-color, #2e7d32); }'
  + '.name { flex: 1; color: var(--primary-text-color); }'
  + '.remain { font-weight: 500; font-size: 0.9em; }'
  + '.row.expired .remain { color: var(--dark-error-color, #c62828); }'
  + '.row.warning .remain { color: var(--dark-warning-color, #ef6c00); }'
  + '.row.ok .remain { color: var(--secondary-text-color); }'
  + '.empty { padding: 20px; text-align: center; color: var(--secondary-text-color); font-size: 0.88em; }'
  + '.footer { padding: 8px 16px; border-top: 1px solid var(--divider-color, #e0e0e0); text-align: center; color: var(--primary-color, #1976d2); cursor: pointer; font-size: 0.85em; font-weight: 500; }'
  + '.footer:hover { background: rgba(25,118,210,0.08); }';

var dialogStyles = ''
  + '.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; padding: 20px; overflow-y: auto; }'
  + '.dialog { background: var(--primary-background-color, #1c1f24); border-radius: var(--ha-card-border-radius, 12px); max-width: 800px; width: 100%; margin-top: 10vh; margin-bottom: 40px; box-shadow: 0 12px 40px rgba(0,0,0,0.5); }'
  + '.d-header { display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-bottom: 1px solid var(--divider-color, #2a2e35); }'
  + '.d-title { flex: 1; font-weight: 600; font-size: 1.1em; color: var(--primary-text-color); }'
  + '.btn-add { background: var(--primary-color, #1976d2); color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85em; font-weight: 500; }'
  + '.btn-close { background: none; border: none; font-size: 1.4em; color: var(--secondary-text-color); cursor: pointer; padding: 0 4px; line-height: 1; }'
  + '.d-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; padding: 16px 20px; }'
  + '.tile { background: var(--primary-background-color, #2a2e35); border-radius: 8px; padding: 14px; }'
  + '.t-name { font-weight: 600; font-size: 0.95em; color: var(--primary-text-color); margin-bottom: 4px; }'
  + '.t-meta { font-size: 0.8em; color: var(--secondary-text-color); margin-bottom: 6px; }'
  + '.t-status { font-size: 0.82em; font-weight: 500; margin-bottom: 10px; }'
  + '.t-actions { display: flex; gap: 6px; }'
  + '.act { background: var(--divider-color, #3a3e45); color: var(--primary-text-color); border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em; }'
  + '.act.danger { color: var(--dark-error-color, #ef5350); }'
  + '#form-container { display: none; }'
  + '.form-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }'
  + '.form-box { background: var(--card-background-color, #1c1f24); border-radius: var(--ha-card-border-radius, 12px); max-width: 420px; width: 100%; padding: 0; box-shadow: 0 12px 40px rgba(0,0,0,0.5); }'
  + '.f-header { display: flex; align-items: center; padding: 14px 20px; border-bottom: 1px solid var(--divider-color, #2a2e35); }'
  + '.f-header h3 { flex: 1; margin: 0; font-size: 1em; color: var(--primary-text-color); }'
  + '.f-body { padding: 16px 20px; }'
  + '.f-body label { display: block; margin-bottom: 10px; font-size: 0.85em; color: var(--primary-text-color); font-weight: 500; }'
  + '.f-body input, .f-body select { display: block; width: 100%; margin-top: 4px; padding: 8px 10px; border: 1px solid var(--divider-color, #3a3e45); border-radius: 6px; font-size: 0.9em; background: var(--primary-background-color, #1c1f24); color: var(--primary-text-color); box-sizing: border-box; }'
  + '.f-actions { display: flex; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--divider-color, #2a2e35); }'
  + '.f-actions button { flex: 1; padding: 9px 14px; border-radius: 6px; border: none; font-size: 0.9em; font-weight: 500; cursor: pointer; }'
  + '.btn-save { background: var(--primary-color, #1976d2); color: #fff; }'
  + '.btn-cancel { background: var(--divider-color, #3a3e45); color: var(--primary-text-color); }';

customElements.define("task-timers-card", TaskTimersCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "task-timers-card",
  name: "Task Timers",
  description: "Maintenance timer summary and management card.",
});

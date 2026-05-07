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
      if (warning.length) badgeHTML += '<span class="badge-chip warn">' + warning.length + '</span>';
      if (expired.length) badgeHTML += '<span class="badge-chip exp">' + expired.length + '</span>';
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
    var remain;
    if (t.is_expired) {
      remain = "Expired " + this._fmtAgo(Math.abs(t.remaining_seconds)) + " ago";
    } else {
      remain = "Due in " + this._fmtRemaining(t.remaining_seconds);
    }
    return '<div class="row ' + cls + '">'
      + '<div class="dot ' + cls + '"></div>'
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
    var clr = t.is_expired ? "var(--rgb-danger)" : t.is_warning ? "var(--rgb-warning)" : "var(--rgb-success)";
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
    return '<div class="tile" style="border-left:3px solid rgb(' + clr + ')" data-id="' + t.id + '">'
      + '<div class="t-name">' + this._esc(t.name) + '</div>'
      + '<div class="t-meta">' + this._esc(t.type) + ' &middot; ' + schedule + '</div>'
      + '<div class="t-status" style="color:rgb(' + clr + ')">' + status + '</div>'
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
  + '.header { display: flex; align-items: center; gap: var(--mush-spacing, 12px); padding: var(--mush-title-padding, 16px 12px 12px); }'
  + '.title { flex: 1; font-weight: var(--mush-title-font-weight, normal); font-size: var(--mush-title-font-size, 24px); color: var(--mush-title-color, var(--primary-text-color)); letter-spacing: var(--mush-title-letter-spacing, -0.288px); line-height: var(--mush-title-line-height, 32px); }'
  + '.badges { display: flex; gap: var(--mush-chip-spacing, 8px); }'
  + '.badge-chip { display: flex; align-items: center; justify-content: center; height: var(--mush-chip-height, 36px); min-width: var(--mush-chip-height, 36px); padding: var(--mush-chip-padding, 0 10px); border-radius: var(--mush-chip-border-radius, 18px); border: var(--mush-chip-border-width, 1px) solid var(--mush-chip-border-color, var(--ha-card-border-color, var(--divider-color))); box-shadow: var(--mush-chip-box-shadow, none); background: var(--mush-chip-background, var(--card-background-color, #fff)); font-size: var(--mush-chip-font-size, 12px); font-weight: var(--mush-chip-font-weight, bold); box-sizing: border-box; transition: box-shadow 180ms ease-in-out; }'
  + '.badge-chip.warn { color: rgb(var(--rgb-warning)); }'
  + '.badge-chip.exp { color: rgb(var(--rgb-danger)); }'
  + '.list { padding: 4px 0; }'
  + '.row { display: flex; align-items: center; gap: var(--mush-spacing, 10px); padding: 8px 12px; }'
  + '.row:not(:last-child) { border-bottom: 1px solid var(--divider-color, #f0f0f0); }'
  + '.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }'
  + '.dot.warning { background: rgb(var(--rgb-warning)); }'
  + '.dot.expired { background: rgb(var(--rgb-danger)); }'
  + '.dot.ok { background: rgb(var(--rgb-success)); }'
  + '.name { flex: 1; font-weight: var(--mush-card-primary-font-weight, 500); font-size: var(--mush-card-primary-font-size, 14px); line-height: var(--mush-card-primary-line-height, 20px); letter-spacing: var(--mush-card-primary-letter-spacing, 0.1px); color: var(--mush-card-primary-color, var(--primary-text-color)); }'
  + '.remain { font-weight: var(--mush-card-secondary-font-weight, 400); font-size: var(--mush-card-secondary-font-size, 12px); line-height: var(--mush-card-secondary-line-height, 16px); letter-spacing: var(--mush-card-secondary-letter-spacing, 0.4px); }'
  + '.row.expired .remain { color: rgb(var(--rgb-danger)); }'
  + '.row.warning .remain { color: rgb(var(--rgb-warning)); }'
  + '.row.ok .remain { color: var(--mush-card-secondary-color, var(--secondary-text-color)); }'
  + '.empty { padding: 20px; text-align: center; color: var(--secondary-text-color); font-size: var(--mush-card-secondary-font-size, 12px); }'
  + '.footer { display: flex; align-items: center; justify-content: center; padding: 8px 12px; border-top: 1px solid var(--divider-color, #e0e0e0); color: var(--primary-color); cursor: pointer; font-size: var(--mush-card-secondary-font-size, 12px); font-weight: 500; transition: background-color 280ms ease-in-out; }'
  + '.footer:hover { background: rgba(var(--rgb-primary-color), 0.08); }';

var dialogStyles = ''
  + '.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; padding: 20px; overflow-y: auto; }'
  + '.dialog { background: var(--card-background-color, var(--primary-background-color, #fafafa)); border-radius: var(--ha-card-border-radius, 12px); max-width: 800px; width: 100%; margin-top: 10vh; margin-bottom: 40px; box-shadow: var(--ha-card-box-shadow, 0 2px 2px rgba(0,0,0,0.14)), 0 12px 40px rgba(0,0,0,0.25); }'
  + '.d-header { display: flex; align-items: center; gap: var(--mush-spacing, 10px); padding: 16px 20px; border-bottom: 1px solid var(--divider-color, #e0e0e0); }'
  + '.d-title { flex: 1; font-weight: var(--mush-title-font-weight, normal); font-size: var(--mush-title-font-size, 24px); line-height: var(--mush-title-line-height, 32px); letter-spacing: var(--mush-title-letter-spacing, -0.288px); color: var(--mush-title-color, var(--primary-text-color)); }'
  + '.btn-add { background: var(--primary-color); color: var(--text-primary-color, #fff); border: none; padding: 8px 18px; border-radius: var(--mush-control-border-radius, 12px); cursor: pointer; font-size: var(--mush-card-primary-font-size, 14px); font-weight: 500; transition: background-color 280ms ease-in-out; }'
  + '.btn-add:hover { background: var(--primary-color); filter: brightness(1.1); }'
  + '.btn-close { background: none; border: none; font-size: 24px; color: var(--secondary-text-color); cursor: pointer; padding: 0 4px; line-height: 0; }'
  + '.d-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--mush-spacing, 10px); padding: var(--mush-spacing, 10px) 20px 20px; }'
  + '.tile { background: var(--ha-card-background, var(--card-background-color, #fff)); border-radius: var(--ha-card-border-radius, 12px); padding: 14px; box-shadow: var(--ha-card-box-shadow, 0 1px 3px rgba(0,0,0,0.12)); transition: box-shadow 180ms ease-in-out; }'
  + '.tile:hover { box-shadow: var(--ha-card-box-shadow, 0 1px 3px rgba(0,0,0,0.12)), 0 0 0 1px var(--divider-color, #e0e0e0); }'
  + '.t-name { font-weight: var(--mush-card-primary-font-weight, 500); font-size: var(--mush-card-primary-font-size, 14px); line-height: var(--mush-card-primary-line-height, 20px); letter-spacing: var(--mush-card-primary-letter-spacing, 0.1px); color: var(--mush-card-primary-color, var(--primary-text-color)); margin-bottom: 4px; }'
  + '.t-meta { font-size: var(--mush-card-secondary-font-size, 12px); font-weight: var(--mush-card-secondary-font-weight, 400); line-height: var(--mush-card-secondary-line-height, 16px); letter-spacing: var(--mush-card-secondary-letter-spacing, 0.4px); color: var(--mush-card-secondary-color, var(--secondary-text-color)); margin-bottom: 6px; }'
  + '.t-status { font-size: var(--mush-card-secondary-font-size, 12px); font-weight: 500; margin-bottom: 10px; }'
  + '.t-actions { display: flex; gap: var(--mush-chip-spacing, 8px); }'
  + '.act { display: inline-flex; align-items: center; justify-content: center; height: var(--mush-control-height, 42px); min-width: var(--mush-control-height, 42px); padding: 0 calc(var(--mush-control-height, 42px) * 0.3); border: 1px solid var(--divider-color, #e0e0e0); border-radius: var(--mush-control-border-radius, 12px); background: var(--ha-card-background, var(--card-background-color, #fff)); color: var(--primary-text-color); cursor: pointer; font-size: 12px; font-weight: 500; box-sizing: border-box; transition: background-color 280ms ease-in-out, box-shadow 180ms ease-in-out; }'
  + '.act:hover { background: rgba(var(--rgb-primary-color), 0.08); }'
  + '.act.danger { color: rgb(var(--rgb-danger)); border-color: rgba(var(--rgb-danger), 0.4); }'
  + '.act.danger:hover { background: rgba(var(--rgb-danger), 0.08); }'
  + '#form-container { display: none; }'
  + '.form-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }'
  + '.form-box { background: var(--card-background-color, var(--primary-background-color, #fafafa)); border-radius: var(--ha-card-border-radius, 12px); max-width: 420px; width: 100%; box-shadow: var(--ha-card-box-shadow, 0 2px 2px rgba(0,0,0,0.14)), 0 12px 40px rgba(0,0,0,0.25); }'
  + '.f-header { display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--divider-color, #e0e0e0); }'
  + '.f-header h3 { flex: 1; margin: 0; font-weight: var(--mush-title-font-weight, normal); font-size: var(--mush-card-primary-font-size, 14px); color: var(--primary-text-color); }'
  + '.f-body { padding: var(--mush-spacing, 10px) 20px; }'
  + '.f-body label { display: block; margin-bottom: 12px; font-weight: var(--mush-card-primary-font-weight, 500); font-size: var(--mush-card-secondary-font-size, 12px); color: var(--secondary-text-color); }'
  + '.f-body input, .f-body select { display: block; width: 100%; margin-top: 4px; padding: 0 12px; height: var(--mush-control-height, 42px); border: 1px solid var(--divider-color, #e0e0e0); border-radius: var(--mush-control-border-radius, 12px); font-size: var(--mush-card-primary-font-size, 14px); background: var(--ha-card-background, var(--card-background-color, #fff)); color: var(--primary-text-color); box-sizing: border-box; transition: border-color 180ms ease-in-out, box-shadow 180ms ease-in-out; }'
  + '.f-body input:focus, .f-body select:focus { border-color: var(--primary-color); box-shadow: 0 0 0 1px var(--primary-color); outline: none; }'
  + '.f-actions { display: flex; gap: var(--mush-spacing, 10px); padding: 14px 20px; border-top: 1px solid var(--divider-color, #e0e0e0); }'
  + '.f-actions button { flex: 1; height: var(--mush-control-height, 42px); border-radius: var(--mush-control-border-radius, 12px); border: none; font-size: var(--mush-card-primary-font-size, 14px); font-weight: 500; cursor: pointer; transition: background-color 280ms ease-in-out; }'
  + '.btn-save { background: var(--primary-color); color: var(--text-primary-color, #fff); }'
  + '.btn-save:hover { filter: brightness(1.1); }'
  + '.btn-cancel { background: none; border: 1px solid var(--divider-color, #e0e0e0) !important; color: var(--primary-text-color); }'
  + '.btn-cancel:hover { background: rgba(var(--rgb-primary-color), 0.08); }';

customElements.define("task-timers-card", TaskTimersCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "task-timers-card",
  name: "Task Timers",
  description: "Maintenance timer summary and management card.",
});

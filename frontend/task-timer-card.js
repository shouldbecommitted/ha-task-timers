import { LitElement, html, css } from "https://cdn.jsdelivr.net/gh/lit/lit@2/index.js?module";
import { ifDefined } from "https://cdn.jsdelivr.net/gh/lit/lit@2/directives/if-defined.js?module";

class TaskTimerCard extends LitElement {
  static properties = {
    hass: {},
    config: {},
    _timers: { state: true },
    _loading: { state: true },
  };

  static getStubConfig() {
    return {
      type: "custom:task-timer-card",
    };
  }

  static getConfigElement() {
    return document.createElement("task-timer-card-editor");
  }

  setConfig(config) {
    this.config = config;
  }

  async connectedCallback() {
    super.connectedCallback();
    this._loading = true;
    await this._fetchTimers();
    setInterval(() => this._fetchTimers(), 60000); // Refresh every minute
  }

  async _fetchTimers() {
    try {
      const response = await this.hass.callWS({
        type: "task_timers/list",
      });
      this._timers = response.timers || [];
      this._loading = false;
      this.requestUpdate();
    } catch (err) {
      console.error("Error fetching timers:", err);
      this._loading = false;
    }
  }

  async _resetTimer(timerId) {
    try {
      await this.hass.callService("task_timers", "reset_timer", {
        timer_id: timerId,
      });
      await this._fetchTimers();
    } catch (err) {
      console.error("Error resetting timer:", err);
    }
  }

  _formatTimeRemaining(seconds) {
    if (seconds < 0) return "Expired";
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  render() {
    if (this._loading) {
      return html`<div class="loading">Loading timers...</div>`;
    }

    if (!this._timers || this._timers.length === 0) {
      return html`<div class="empty">No timers configured</div>`;
    }

    return html`
      <ha-card header="Task Timers">
        <div class="card-content">
          ${this._timers.map(
            (timer) => html`
              <div class="timer-item ${timer.is_expired ? "expired" : timer.is_warning ? "warning" : ""}">
                <div class="timer-info">
                  <div class="timer-name">${timer.name}</div>
                  <div class="timer-time">
                    ${this._formatTimeRemaining(timer.remaining_seconds)}
                  </div>
                </div>
                <ha-icon-button
                  .title="Reset timer"
                  @click="${() => this._resetTimer(timer.id)}"
                >
                  <ha-icon icon="mdi:refresh"></ha-icon>
                </ha-icon-button>
              </div>
            `
          )}
        </div>
      </ha-card>
    `;
  }

  static styles = css`
    ha-card {
      box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.1));
    }

    .card-content {
      padding: 16px;
    }

    .timer-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      margin: 8px 0;
      background: var(--ha-card-background, white);
      border-radius: 8px;
      border-left: 4px solid var(--primary-color);
    }

    .timer-item.expired {
      border-left-color: #d32f2f;
      background: rgba(211, 47, 47, 0.1);
    }

    .timer-item.warning {
      border-left-color: #f57c00;
      background: rgba(245, 124, 0, 0.1);
    }

    .timer-info {
      flex: 1;
    }

    .timer-name {
      font-weight: 500;
      color: var(--primary-text-color);
      margin-bottom: 4px;
    }

    .timer-time {
      font-size: 0.9em;
      color: var(--secondary-text-color);
    }

    .timer-item.expired .timer-time {
      color: #d32f2f;
      font-weight: 500;
    }

    .timer-item.warning .timer-time {
      color: #f57c00;
      font-weight: 500;
    }

    ha-icon-button {
      color: var(--primary-color);
    }

    .loading,
    .empty {
      padding: 24px;
      text-align: center;
      color: var(--secondary-text-color);
    }
  `;
}

customElements.define("task-timer-card", TaskTimerCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "task-timer-card",
  name: "Task Timer Card",
  description: "Displays active task timers with reset buttons",
});

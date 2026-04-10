import { LitElement, html, css } from "https://cdn.jsdelivr.net/gh/lit/lit@2/index.js?module";

class TaskExpiryCard extends LitElement {
  static properties = {
    hass: {},
    config: {},
    _timers: { state: true },
    _loading: { state: true },
  };

  static getStubConfig() {
    return {
      type: "custom:task-expiry-card",
      days_warning: 7,
    };
  }

  setConfig(config) {
    this.config = config;
  }

  async connectedCallback() {
    super.connectedCallback();
    this._loading = true;
    await this._fetchTimers();
    this._interval = setInterval(() => this._fetchTimers(), 300000); // Refresh every 5 minutes
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._interval);
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

  _getExpiringTimers() {
    const daysWarning = this.config.days_warning || 7;
    const secondsWarning = daysWarning * 86400;
    
    return this._timers.filter(
      (timer) =>
        timer.is_expired || 
        (timer.remaining_seconds > 0 && timer.remaining_seconds < secondsWarning)
    );
  }

  _formatTimeRemaining(seconds) {
    if (seconds < 0) {
      const absSeconds = Math.abs(seconds);
      const days = Math.floor(absSeconds / 86400);
      const hours = Math.floor((absSeconds % 86400) / 3600);
      if (days > 0) return `Expired ${days}d ${hours}h ago`;
      return `Expired ${hours}h ago`;
    }
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  }

  render() {
    if (this._loading) {
      return html`<div class="loading">Loading...</div>`;
    }

    const expiringTimers = this._getExpiringTimers();

    if (expiringTimers.length === 0) {
      return html`<div class="empty">No timers expiring soon</div>`;
    }

    return html`
      <ha-card header="Expiring Soon">
        <div class="card-content">
          ${expiringTimers.map(
            (timer) => html`
              <div class="expiry-item ${timer.is_expired ? "expired" : "warning"}">
                <ha-icon
                  class="expiry-icon"
                  .icon="${timer.is_expired ? "mdi:alert-circle" : "mdi:clock-alert"}"
                ></ha-icon>
                <div class="expiry-info">
                  <div class="expiry-name">${timer.name}</div>
                  <div class="expiry-time">
                    ${this._formatTimeRemaining(timer.remaining_seconds)}
                  </div>
                </div>
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

    .expiry-item {
      display: flex;
      align-items: center;
      padding: 12px;
      margin: 8px 0;
      border-radius: 8px;
      border-left: 4px solid;
    }

    .expiry-item.expired {
      background: rgba(211, 47, 47, 0.15);
      border-left-color: #d32f2f;
    }

    .expiry-item.warning {
      background: rgba(245, 124, 0, 0.15);
      border-left-color: #f57c00;
    }

    .expiry-icon {
      margin-right: 12px;
      color: inherit;
    }

    .expiry-item.expired .expiry-icon {
      color: #d32f2f;
    }

    .expiry-item.warning .expiry-icon {
      color: #f57c00;
    }

    .expiry-info {
      flex: 1;
    }

    .expiry-name {
      font-weight: 500;
      color: var(--primary-text-color);
    }

    .expiry-time {
      font-size: 0.85em;
      color: var(--secondary-text-color);
      margin-top: 2px;
    }

    .expiry-item.expired .expiry-time,
    .expiry-item.expired .expiry-name {
      color: #d32f2f;
    }

    .expiry-item.warning .expiry-time,
    .expiry-item.warning .expiry-name {
      color: #f57c00;
    }

    .loading,
    .empty {
      padding: 24px;
      text-align: center;
      color: var(--secondary-text-color);
    }
  `;
}

customElements.define("task-expiry-card", TaskExpiryCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "task-expiry-card",
  name: "Task Expiry Card",
  description: "Displays timers that are expiring soon or already expired",
});

/* =========================================================
   AGC SCADA Hub — scripts/api.js
   Lightweight fetch()-based webhook utility for pushing
   Execution Board (Kanban) updates out to external project
   management / automation tools — e.g. a ClickUp webhook or
   an n8n workflow trigger. No SDKs, no backend — just a
   direct client-side POST.

   Webhook URLs are user-supplied (via Settings) and stored
   only in this browser's localStorage — never hard-coded.
   ========================================================= */

(function (global) {
  "use strict";

  const AGC = global.AGC = global.AGC || {};

  const WEBHOOK_STORE_KEY = "agc_scada_hub_webhooks_v1";

  /* ---------------- Webhook config storage ---------------- */

  function getWebhookConfig() {
    try {
      const raw = localStorage.getItem(WEBHOOK_STORE_KEY);
      return raw ? JSON.parse(raw) : { clickup: "", n8n: "" };
    } catch (e) {
      console.warn("AGC.Api: could not read webhook config", e);
      return { clickup: "", n8n: "" };
    }
  }

  function saveWebhookConfig(config) {
    try {
      localStorage.setItem(WEBHOOK_STORE_KEY, JSON.stringify(config));
      return true;
    } catch (e) {
      console.error("AGC.Api: could not save webhook config", e);
      return false;
    }
  }

  /* ---------------- Core POST helper ---------------- */

  /**
   * POST a JSON payload to a webhook URL.
   * Returns { ok, status, error? }. Never throws — designed to
   * fail gracefully for site engineers on flaky connections.
   */
  async function postWebhook(url, payload, { timeoutMs = 10000 } = {}) {
    if (!url) {
      return { ok: false, status: 0, error: "No webhook URL configured." };
    }
    if (!navigator.onLine) {
      return { ok: false, status: 0, error: "Device is offline. This update was not synced." };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timer);
      return { ok: response.ok, status: response.status };
    } catch (err) {
      clearTimeout(timer);
      const message = err.name === "AbortError" ? "Request timed out." : (err.message || "Network error.");
      return { ok: false, status: 0, error: message };
    }
  }

  /* ---------------- Payload templates ---------------- */

  /**
   * Build a ClickUp-style task payload from an AGC execution task.
   * Point this at a ClickUp "create task" webhook (e.g. via an
   * automation platform) or a custom middleware endpoint —
   * ClickUp's native API requires an auth header, which should
   * be attached by whatever middleware/webhook receives this,
   * not stored in this static frontend.
   */
  function buildClickUpPayload(task) {
    return {
      source: "AGC SCADA Hub",
      event: "kanban_task_update",
      task: {
        name: task.title,
        description: [
          task.project ? `Project: ${task.project}` : null,
          task.notes ? `Notes: ${task.notes}` : null
        ].filter(Boolean).join("\n"),
        status: task.phase,               // maps to ClickUp list/status name
        assignee_name: task.owner || "Unassigned",
        team: task.team,
        tags: ["scada", "agc", task.phase.toLowerCase().replace(/\s+/g, "-")]
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Build a generic n8n workflow-trigger payload. n8n Webhook
   * nodes accept arbitrary JSON, so this just sends a clean,
   * predictable envelope an n8n workflow can branch on via
   * `event` and `phase`.
   */
  function buildN8nPayload(task, extra) {
    return {
      source: "AGC SCADA Hub",
      event: "kanban_task_update",
      phase: task.phase,
      task: {
        id: task.id,
        title: task.title,
        project: task.project,
        owner: task.owner,
        team: task.team,
        notes: task.notes
      },
      meta: extra || {},
      timestamp: new Date().toISOString()
    };
  }

  /* ---------------- Public sync entry points ---------------- */

  /**
   * Push a single task update to ClickUp (or a middleware
   * webhook standing in for it). Resolves to a result object.
   */
  async function syncTaskToClickUp(task) {
    const { clickup } = getWebhookConfig();
    const payload = buildClickUpPayload(task);
    return postWebhook(clickup, payload);
  }

  /**
   * Fire an n8n automation trigger for a task update
   * (e.g. to notify Slack/Teams, update a Google Sheet,
   * or kick off a downstream workflow).
   */
  async function syncTaskToN8n(task, extra) {
    const { n8n } = getWebhookConfig();
    const payload = buildN8nPayload(task, extra);
    return postWebhook(n8n, payload);
  }

  /**
   * Push the entire current board (all tasks) in one call —
   * useful for an end-of-day sync rather than per-card firing.
   */
  async function syncFullBoardToN8n(tasks) {
    const { n8n } = getWebhookConfig();
    const payload = {
      source: "AGC SCADA Hub",
      event: "kanban_full_sync",
      taskCount: tasks.length,
      tasks: tasks.map((t) => ({
        id: t.id, title: t.title, project: t.project,
        owner: t.owner, team: t.team, phase: t.phase
      })),
      timestamp: new Date().toISOString()
    };
    return postWebhook(n8n, payload);
  }

  AGC.Api = {
    getWebhookConfig,
    saveWebhookConfig,
    postWebhook,
    buildClickUpPayload,
    buildN8nPayload,
    syncTaskToClickUp,
    syncTaskToN8n,
    syncFullBoardToN8n
  };
})(window);

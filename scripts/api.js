/* =========================================================
   AGC SCADA Hub — scripts/api.js
   Enterprise Webhook Utility with Offline Background Sync
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
      return false;
    }
  }

  /* ---------------- Offline Queue Logic ---------------- */
  async function enqueuePayload(url, payload, targetName) {
    if (!window.DB) {
      console.error("Database not initialized, cannot queue payload.");
      return;
    }
    
    const item = {
      id: window.crypto?.randomUUID ? window.crypto.randomUUID() : Date.now().toString(),
      url,
      payload,
      targetName,
      queuedAt: new Date().toISOString()
    };

    await window.DB.put("sync_queue", item);
    console.log(`[Background Sync] Task queued for ${targetName}`);
  }

  async function processSyncQueue() {
    if (!navigator.onLine || !window.DB) return;

    const queue = await window.DB.getAll("sync_queue");
    if (queue.length === 0) return;

    console.log(`[Background Sync] Processing ${queue.length} queued update(s)...`);

    for (const item of queue) {
      try {
        const response = await fetch(item.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload)
        });

        if (response.ok) {
          await window.DB.delete("sync_queue", item.id);
          console.log(`[Background Sync] Successfully synced queued item to ${item.targetName}`);
        } else {
          console.warn(`[Background Sync] Target ${item.targetName} rejected payload (Status: ${response.status})`);
        }
      } catch (err) {
        console.warn(`[Background Sync] Network failed while processing queue. Pausing sync.`);
        break; // Stop loop, network dropped again
      }
    }
  }

  /* ---------------- Core POST helper ---------------- */
  async function postWebhook(url, payload, { timeoutMs = 10000, targetName = "Unknown API" } = {}) {
    if (!url) return { ok: false, status: 0, error: "No webhook URL configured." };

    // 1. If explicitly offline, queue it instantly
    if (!navigator.onLine) {
      await enqueuePayload(url, payload, targetName);
      return { ok: true, queued: true }; // Tell the UI it was handled safely
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
      
      return { ok: response.ok, status: response.status, queued: false };
    } catch (err) {
      clearTimeout(timer);
      
      // 2. If the request timed out or network failed mid-flight, rescue it by queuing
      await enqueuePayload(url, payload, targetName);
      return { ok: true, queued: true };
    }
  }

  /* ---------------- Payload templates ---------------- */
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
        status: task.phase,
        assignee_name: task.owner || "Unassigned",
        team: task.team,
        tags: ["scada", "agc", task.phase.toLowerCase().replace(/\s+/g, "-")]
      },
      timestamp: new Date().toISOString()
    };
  }

  function buildN8nPayload(task, extra) {
    return {
      source: "AGC SCADA Hub",
      event: "kanban_task_update",
      phase: task.phase,
      task: {
        id: task.id, title: task.title, project: task.project,
        owner: task.owner, team: task.team, notes: task.notes
      },
      meta: extra || {},
      timestamp: new Date().toISOString()
    };
  }

  /* ---------------- Public sync entry points ---------------- */
  async function syncTaskToClickUp(task) {
    const { clickup } = getWebhookConfig();
    return postWebhook(clickup, buildClickUpPayload(task), { targetName: "ClickUp" });
  }

  async function syncTaskToN8n(task, extra) {
    const { n8n } = getWebhookConfig();
    return postWebhook(n8n, buildN8nPayload(task, extra), { targetName: "n8n Task Sync" });
  }

  async function syncFullBoardToN8n(tasks) {
    const { n8n } = getWebhookConfig();
    const payload = {
      source: "AGC SCADA Hub",
      event: "kanban_full_sync",
      taskCount: tasks.length,
      tasks: tasks.map(t => ({
        id: t.id, title: t.title, project: t.project,
        owner: t.owner, team: t.team, phase: t.phase
      })),
      timestamp: new Date().toISOString()
    };
    return postWebhook(n8n, payload, { targetName: "n8n Board Sync" });
  }

  AGC.Api = {
    getWebhookConfig,
    saveWebhookConfig,
    postWebhook,
    syncTaskToClickUp,
    syncTaskToN8n,
    syncFullBoardToN8n,
    processSyncQueue 
  };
})(window);

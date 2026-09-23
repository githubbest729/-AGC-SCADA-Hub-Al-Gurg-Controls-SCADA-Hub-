/* =========================================================
   AGC SCADA Hub — scripts/punchlist.js
   Enterprise Site Snag Tracking Module
   Features: XSS-safe rendering, WhatsApp deep-linking,
   Safe IndexedDB initialization, and Blob CSV Export.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const container = document.getElementById("punchlist-container");
  const addBtn = document.getElementById("add-punchlist-btn");
  
  // Look for an export button in the HTML (Optional but recommended)
  const exportBtn = document.getElementById("export-punchlist-btn"); 
  
  const modalOverlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalFooter = document.getElementById("modal-footer");
  const modalClose = document.getElementById("modal-close");

  let punchlist = [];

  // --- Security: HTML Escaper to prevent XSS Attacks ---
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  // --- Enterprise Initialization ---
  async function initPunchlist() {
    if (!window.DB) {
      console.error("Critical: Database module not loaded.");
      return;
    }

    try {
      // Safely ensure DB is initialized before querying
      await window.DB.init();
      punchlist = await window.DB.getAll("punchlist");
    } catch (e) {
      console.warn("AGC Punchlist Module: DB initialization warning.", e);
    }
    
    renderPunchlist();
  }

  // --- Core Rendering ---
  function renderPunchlist() {
    if (!container) return;
    container.innerHTML = "";

    if (punchlist.length === 0) {
      container.innerHTML = `<p class="empty-state" style="grid-column: 1 / -1;">No site snags logged. Everything is running smoothly!</p>`;
      return;
    }

    punchlist.forEach((item) => {
      const card = document.createElement("div");
      card.className = "card pl-card";

      // Build WhatsApp Deep-Link String safely
      const waText = encodeURIComponent(
        `⚠️ *Site Snag Alert*\n` +
        `*Project:* AGC SCADA Execution\n` +
        `*Discipline:* ${item.discipline || 'General'}\n` +
        `*Issue:* ${item.title || 'Untitled'}\n` +
        `*Notes:* ${item.notes || 'N/A'}\n` +
        `*Status:* ${item.status || 'Open'}`
      );
      const waLink = `https://wa.me/?text=${waText}`;

      // Set badge color based on status
      let badgeClass = "badge-open";
      if (item.status === "In Progress") badgeClass = "badge-progress";
      if (item.status === "Blocked") badgeClass = "badge-blocked";
      if (item.status === "Delivered" || item.status === "Closed") badgeClass = "badge-delivered";

      // XSS-Safe HTML Injection
      card.innerHTML = `
        <div class="pl-card-top">
          <div>
            <div class="pl-card-title">${escapeHtml(item.title)}</div>
            <div class="pl-card-meta">Logged: ${escapeHtml(item.date)} | Tag: ${escapeHtml(item.discipline)}</div>
          </div>
          <div class="pl-card-badges">
            <span class="badge ${badgeClass}">${escapeHtml(item.status)}</span>
          </div>
        </div>
        ${item.notes ? `<div class="pl-card-notes">${escapeHtml(item.notes)}</div>` : ''}
        <div class="pl-card-actions">
          <select class="status-update-select" data-id="${item.id}">
            <option value="Open" ${item.status === 'Open' ? 'selected' : ''}>Open</option>
            <option value="In Progress" ${item.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Blocked" ${item.status === 'Blocked' ? 'selected' : ''}>Blocked</option>
            <option value="Closed" ${item.status === 'Closed' || item.status === 'Delivered' ? 'selected' : ''}>Closed / Fixed</option>
          </select>
          <a href="${waLink}" target="_blank" class="btn btn-sm btn-whatsapp" style="text-decoration:none; display:inline-flex;">📱 Share to WA</a>
          <button class="btn btn-sm btn-danger delete-snag-btn" data-id="${item.id}" title="Delete Snag">✕</button>
        </div>
      `;
      container.appendChild(card);
    });

    // Attach Status Update Listeners
    document.querySelectorAll('.status-update-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        const snag = punchlist.find(s => s.id === id);
        if (snag) {
          snag.status = e.target.value;
          await window.DB.put("punchlist", snag);
          punchlist = await window.DB.getAll("punchlist");
          renderPunchlist();
        }
      });
    });

    // Attach Delete Listeners
    document.querySelectorAll('.delete-snag-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (confirm("Permanently delete this snag?")) {
          await window.DB.delete("punchlist", id);
          punchlist = await window.DB.getAll("punchlist");
          renderPunchlist();
        }
      });
    });
  }

  // --- Modal Logic ---
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (!modalTitle || !modalBody || !modalFooter || !modalOverlay) return;

      modalTitle.textContent = "Log New Site Snag";
      
      modalBody.innerHTML = `
        <label>Issue / Title
          <input type="text" id="snag-title" placeholder="e.g. Field sensor wired backwards" required />
        </label>
        <label>Responsible Discipline
          <select id="snag-discipline">
            <option value="Electrical">Electrical</option>
            <option value="Mechanical">Mechanical</option>
            <option value="Instrumentation">Instrumentation</option>
            <option value="IT/Network">IT / Network</option>
            <option value="Client">Client</option>
          </select>
        </label>
        <label>Notes / Resolution Steps
          <textarea id="snag-notes" rows="3" placeholder="Additional details or location..."></textarea>
        </label>
      `;
      
      modalFooter.innerHTML = `
        <button class="btn btn-ghost" id="cancel-snag-btn">Cancel</button>
        <button class="btn btn-primary" id="save-snag-btn">Save Snag</button>
      `;

      modalOverlay.classList.remove("hidden");

      document.getElementById('cancel-snag-btn').addEventListener('click', () => {
        modalOverlay.classList.add("hidden");
      });

      document.getElementById('save-snag-btn').addEventListener('click', async () => {
        const title = document.getElementById('snag-title').value.trim();
        const discipline = document.getElementById('snag-discipline').value;
        const notes = document.getElementById('snag-notes').value.trim();

        if (!title) {
          alert("Please enter an issue title.");
          return;
        }

        const newSnag = {
          // Safe fallback if crypto.randomUUID is unsupported on an old site tablet
          id: window.crypto?.randomUUID ? window.crypto.randomUUID() : Date.now().toString(),
          title,
          discipline,
          notes,
          status: "Open",
          date: new Date().toISOString().split('T')[0]
        };

        await window.DB.put("punchlist", newSnag);
        punchlist = await window.DB.getAll("punchlist");
        renderPunchlist();
        
        modalOverlay.classList.add("hidden");
      });
    });
  }

  if (modalClose) {
    modalClose.addEventListener('click', () => {
      modalOverlay.classList.add("hidden");
    });
  }

  // --- Enterprise CSV Export ---
  // (Requires adding <button id="export-punchlist-btn">Export</button> to your HTML)
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (punchlist.length === 0) {
        alert("No snags to export.");
        return;
      }
      
      const headers = ["Title", "Discipline", "Status", "Date Logged", "Notes"];
      const rows = punchlist.map(s => [
        s.title, s.discipline, s.status, s.date, s.notes
      ].map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(","));
      
      const csvContent = [headers.join(","), ...rows].join("\r\n");
      
      // Blob export handles unlimited file sizes and applies UTF-8 BOM for Excel
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `AGC-Punchlist-Report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  // Boot up safely
  initPunchlist();
});

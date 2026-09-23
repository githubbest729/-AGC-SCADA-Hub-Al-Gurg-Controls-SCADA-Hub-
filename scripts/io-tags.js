/* =========================================================
   AGC SCADA Hub — scripts/io-tags.js
   Enterprise I/O & Tag Database Module
   Features: XSS-safe rendering, Blob-based CSV handling, 
   dynamic SCADA license sizing, and safe async initialization.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const tbody = document.getElementById("io-tbody");
  const emptyState = document.getElementById("io-empty");
  const searchInput = document.getElementById("io-search");
  const typeFilter = document.getElementById("io-type-filter");
  
  const modalOverlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalFooter = document.getElementById("modal-footer");

  let ioTags = [];

  // --- Security: HTML Escaper ---
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  // --- Enterprise Initialization ---
  async function initIo() {
    if (typeof DB === "undefined") {
      console.error("Critical: Database module not loaded.");
      return;
    }

    try {
      await DB.init();
      ioTags = await DB.getAll("io_tags");
      
      // Seed data if empty
      if (ioTags.length === 0) {
        const res = await fetch("data/io-tags-sample.json");
        if (res.ok) {
          const sampleTags = await res.json();
          for (const tag of sampleTags) await DB.put("io_tags", tag);
          ioTags = await DB.getAll("io_tags");
        }
      }
    } catch (e) {
      console.warn("AGC I/O Module: Initialization notice - no seed data found or DB error.", e);
    }
    
    renderIoTable();
  }

  // --- UI Helpers ---
  function getBadgeClass(type) {
    const t = String(type || "").toUpperCase();
    const badgeMap = {
      "AI": "io-badge-ai",
      "AO": "io-badge-ao",
      "DI": "io-badge-di",
      "DO": "io-badge-do"
    };
    return badgeMap[t] || "io-badge-internal";
  }

  function calculateLicenseTier(total) {
    const tiers = [75, 150, 500, 1500, 5000, 15000, 50000];
    for (let t of tiers) {
      if (total <= t) return `${t} Tags`;
    }
    return "Unlimited";
  }

  // --- Core Rendering ---
  function renderIoTable() {
    if (!tbody) return;
    
    const q = (searchInput.value || "").toLowerCase();
    const f = typeFilter.value;
    let counts = { AI: 0, AO: 0, DI: 0, DO: 0 };
    
    const filtered = ioTags.filter(tag => {
      // Tally absolute counts safely
      if (tag.type && counts[tag.type] !== undefined) counts[tag.type]++;
      
      const matchQ = !q || [tag.tagName, tag.description, tag.plcAddress, tag.hmiScreen]
        .some(val => String(val || "").toLowerCase().includes(q));
      const matchF = !f || tag.type === f;
      return matchQ && matchF;
    });

    // Update Summary Panels
    document.getElementById("count-ai").textContent = counts.AI;
    document.getElementById("count-ao").textContent = counts.AO;
    document.getElementById("count-di").textContent = counts.DI;
    document.getElementById("count-do").textContent = counts.DO;
    
    const totalPhysical = counts.AI + counts.AO + counts.DI + counts.DO;
    const estimatedTotalTags = Math.floor(totalPhysical * 1.4); // 40% margin for soft/internal tags
    document.getElementById("license-tier").textContent = calculateLicenseTier(estimatedTotalTags);

    // Render Table Safely
    tbody.innerHTML = "";
    if (emptyState) emptyState.classList.toggle("hidden", filtered.length > 0);

    filtered.forEach(tag => {
      const tr = document.createElement("tr");
      // XSS Protection applied to all text outputs
      tr.innerHTML = `
        <td class="bold">${escapeHtml(tag.tagName)}</td>
        <td>${escapeHtml(tag.description)}</td>
        <td><span class="badge ${getBadgeClass(tag.type)}">${escapeHtml(tag.type)}</span></td>
        <td class="muted" style="font-family: monospace;">${escapeHtml(tag.plcAddress) || "—"}</td>
        <td>${escapeHtml(tag.hmiScreen) || "—"}</td>
        <td>${escapeHtml(tag.priority) || "Normal"}</td>
        <td>${escapeHtml(tag.status) || "Draft"}</td>
        <td>
          <button class="btn-icon" data-edit-io="${tag.id}" title="Edit Tag">✎</button>
          <button class="btn-icon" data-del-io="${tag.id}" title="Delete Tag">🗑</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Attach row events
    tbody.querySelectorAll("[data-edit-io]").forEach(btn => {
      btn.addEventListener("click", () => openIoModal(btn.dataset.editIo));
    });
    tbody.querySelectorAll("[data-del-io]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (confirm("Permanently delete this I/O tag?")) {
          await DB.delete("io_tags", btn.dataset.delIo);
          ioTags = await DB.getAll("io_tags");
          renderIoTable();
        }
      });
    });
  }

  // --- Modal Logic ---
  function openIoModal(id) {
    const existing = id ? ioTags.find(t => t.id === id) : null;
    const tag = existing || { 
      id: null, tagName: "", description: "", type: "DI", 
      plcAddress: "", hmiScreen: "", priority: "Normal", 
      status: "Draft", notes: "" 
    };

    modalTitle.textContent = existing ? "Edit I/O Tag" : "New I/O Tag";
    modalBody.innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <label>Tag Name <input type="text" id="t-name" value="${escapeHtml(tag.tagName)}" required/></label>
        <label>Signal Type
          <select id="t-type">
            ${["AI","AO","DI","DO","Internal"].map(t => `<option ${tag.type === t ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </label>
      </div>
      <label>Description <input type="text" id="t-desc" value="${escapeHtml(tag.description)}"/></label>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <label>PLC Address <input type="text" id="t-plc" value="${escapeHtml(tag.plcAddress)}"/></label>
        <label>HMI Screen <input type="text" id="t-hmi" value="${escapeHtml(tag.hmiScreen)}"/></label>
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <label>Alarm Priority
          <select id="t-priority">
            ${["None","Low","Normal","High","Critical"].map(p => `<option ${tag.priority === p ? "selected" : ""}>${p}</option>`).join("")}
          </select>
        </label>
        <label>Status
          <select id="t-status">
            ${["Draft","Assigned","Tested","Commissioned"].map(s => `<option ${tag.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </label>
      </div>
      <label>Notes <textarea id="t-notes" rows="2">${escapeHtml(tag.notes)}</textarea></label>
    `;
    
    modalFooter.innerHTML = `
      <button class="btn btn-ghost" id="t-cancel">Cancel</button>
      <button class="btn btn-primary" id="t-save">Save Tag</button>
    `;
    modalOverlay.classList.remove("hidden");

    document.getElementById("t-cancel").addEventListener("click", () => modalOverlay.classList.add("hidden"));
    
    document.getElementById("t-save").addEventListener("click", async () => {
      const tagName = document.getElementById("t-name").value.trim();
      if (!tagName) { 
        alert("Tag Name is required"); 
        return; 
      }
      
      const newTag = {
        id: tag.id || (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now().toString()),
        tagName,
        description: document.getElementById("t-desc").value.trim(),
        type: document.getElementById("t-type").value,
        plcAddress: document.getElementById("t-plc").value.trim(),
        hmiScreen: document.getElementById("t-hmi").value.trim(),
        priority: document.getElementById("t-priority").value,
        status: document.getElementById("t-status").value,
        notes: document.getElementById("t-notes").value.trim()
      };

      await DB.put("io_tags", newTag);
      ioTags = await DB.getAll("io_tags");
      renderIoTable();
      modalOverlay.classList.add("hidden");
    });
  }

  // --- Event Listeners ---
  if (document.getElementById("add-io-btn")) {
    document.getElementById("add-io-btn").addEventListener("click", () => openIoModal());
  }
  if (searchInput) searchInput.addEventListener("input", renderIoTable);
  if (typeFilter) typeFilter.addEventListener("change", renderIoTable);

  // --- Enterprise CSV Export (Blob Based) ---
  const exportBtn = document.getElementById("io-export-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      if (ioTags.length === 0) {
        alert("No I/O tags to export.");
        return;
      }
      
      const headers = ["Tag Name", "Description", "Type", "PLC Address", "HMI Screen", "Priority", "Status", "Notes"];
      const rows = ioTags.map(t => [
        t.tagName, t.description, t.type, t.plcAddress, t.hmiScreen, t.priority, t.status, t.notes
      ].map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(","));
      
      const csvContent = [headers.join(","), ...rows].join("\r\n");
      
      // Blob export handles unlimited file sizes and applies UTF-8 BOM for Excel compatibility
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AGC-IO-List-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  // --- Enterprise CSV Import ---
  const importFile = document.getElementById("io-import-file");
  if (importFile) {
    importFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const lines = event.target.result.split(/\r?\n/).filter(l => l.trim() !== "");
          if (lines.length < 2) {
            alert("The imported CSV appears to be empty or missing headers.");
            return;
          }
          
          let successCount = 0;
          for (let i = 1; i < lines.length; i++) {
            // Safer regex parsing for CSVs that handles standard Excel exports
            const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"\vert{}"$/g, "").trim());
            
            if (cols[0]) {
              await DB.put("io_tags", {
                id: window.crypto?.randomUUID ? window.crypto.randomUUID() : Date.now().toString() + i,
                tagName: cols[0] || "", 
                description: cols[1] || "", 
                type: cols[2] || "Internal", 
                plcAddress: cols[3] || "",
                hmiScreen: cols[4] || "", 
                priority: cols[5] || "Normal", 
                status: cols[6] || "Draft", 
                notes: cols[7] || ""
              });
              successCount++;
            }
          }
          
          ioTags = await DB.getAll("io_tags");
          renderIoTable();
          alert(`Successfully imported ${successCount} I/O tags.`);
        } catch (err) {
          console.error("CSV Import Error", err);
          alert("Failed to parse the CSV file. Please ensure it matches the standard export format.");
        } finally {
          e.target.value = ""; // Reset input so the same file can be selected again
        }
      };
      reader.readAsText(file);
    });
  }

  // Boot up the module
  initIo(); 
});

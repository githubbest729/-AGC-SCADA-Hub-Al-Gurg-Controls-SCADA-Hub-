/* =========================================================
   scripts/io-tags.js
   I/O & Tag Database Module
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  const tbody = document.getElementById("io-tbody");
  const emptyState = document.getElementById("io-empty");
  const searchInput = document.getElementById("io-search");
  const typeFilter = document.getElementById("io-type-filter");
  
  const modalOverlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalFooter = document.getElementById("modal-footer");
  const modalClose = document.getElementById("modal-close");

  let ioTags = [];

  // Initialize and check for seed data
  async function initIo() {
    ioTags = await DB.getAll("io_tags");
    
    // Seed WTP data if completely empty
    if (ioTags.length === 0) {
      try {
        const res = await fetch("data/io-tags-sample.json");
        if (res.ok) {
          const sampleTags = await res.json();
          for (const tag of sampleTags) await DB.put("io_tags", tag);
          ioTags = await DB.getAll("io_tags");
        }
      } catch (e) {
        console.warn("No IO seed data found.");
      }
    }
    
    renderIoTable();
  }

  function getBadgeClass(type) {
    const t = (type || "").toUpperCase();
    if (t === "AI") return "io-badge-ai";
    if (t === "AO") return "io-badge-ao";
    if (t === "DI") return "io-badge-di";
    if (t === "DO") return "io-badge-do";
    return "io-badge-internal";
  }

  function calculateLicenseTier(total) {
    const tiers = [75, 150, 500, 1500, 5000, 15000, 50000];
    for (let t of tiers) {
      if (total <= t) return `${t} Tags`;
    }
    return "Unlimited";
  }

  function renderIoTable() {
    if (!tbody) return;
    
    const q = searchInput.value.toLowerCase();
    const f = typeFilter.value;
    
    let counts = { AI: 0, AO: 0, DI: 0, DO: 0 };
    
    const filtered = ioTags.filter(tag => {
      // Tally absolute counts
      if (counts[tag.type] !== undefined) counts[tag.type]++;
      
      const matchQ = !q || [tag.tagName, tag.description, tag.plcAddress, tag.hmiScreen].some(val => (val || "").toLowerCase().includes(q));
      const matchF = !f || tag.type === f;
      return matchQ && matchF;
    });

    // Update Summary Panels (Based on absolute DB size, not filter)
    document.getElementById("count-ai").textContent = counts.AI;
    document.getElementById("count-ao").textContent = counts.AO;
    document.getElementById("count-di").textContent = counts.DI;
    document.getElementById("count-do").textContent = counts.DO;
    
    const totalPhysical = counts.AI + counts.AO + counts.DI + counts.DO;
    const estimatedTotalTags = Math.floor(totalPhysical * 1.4); // Adding 40% margin for soft/internal tags
    document.getElementById("license-tier").textContent = calculateLicenseTier(estimatedTotalTags);

    tbody.innerHTML = "";
    emptyState.classList.toggle("hidden", filtered.length > 0);

    filtered.forEach(tag => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="bold">${tag.tagName}</td>
        <td>${tag.description}</td>
        <td><span class="badge ${getBadgeClass(tag.type)}">${tag.type}</span></td>
        <td class="muted" style="font-family: monospace;">${tag.plcAddress || "—"}</td>
        <td>${tag.hmiScreen || "—"}</td>
        <td>${tag.priority || "Normal"}</td>
        <td>${tag.status || "Draft"}</td>
        <td>
          <button class="btn-icon" data-edit-io="${tag.id}">✎</button>
          <button class="btn-icon" data-del-io="${tag.id}">🗑</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Attach row events
    tbody.querySelectorAll("[data-edit-io]").forEach(btn => btn.addEventListener("click", () => openIoModal(btn.dataset.editIo)));
    tbody.querySelectorAll("[data-del-io]").forEach(btn => btn.addEventListener("click", async () => {
      if (confirm("Delete this I/O tag?")) {
        await DB.delete("io_tags", btn.dataset.delIo);
        ioTags = await DB.getAll("io_tags");
        renderIoTable();
      }
    }));
  }

  function openIoModal(id) {
    const existing = id ? ioTags.find(t => t.id === id) : null;
    const tag = existing || { id: null, tagName: "", description: "", type: "DI", plcAddress: "", hmiScreen: "", priority: "Normal", status: "Draft", notes: "" };

    modalTitle.textContent = existing ? "Edit I/O Tag" : "New I/O Tag";
    modalBody.innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <label>Tag Name <input type="text" id="t-name" value="${tag.tagName}" required/></label>
        <label>Signal Type
          <select id="t-type">
            ${["AI","AO","DI","DO","Internal"].map(t => `<option ${tag.type===t?"selected":""}>${t}</option>`).join("")}
          </select>
        </label>
      </div>
      <label>Description <input type="text" id="t-desc" value="${tag.description}"/></label>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <label>PLC Address <input type="text" id="t-plc" value="${tag.plcAddress}"/></label>
        <label>HMI Screen <input type="text" id="t-hmi" value="${tag.hmiScreen}"/></label>
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <label>Alarm Priority
          <select id="t-priority">
            ${["None","Low","Normal","High","Critical"].map(p => `<option ${tag.priority===p?"selected":""}>${p}</option>`).join("")}
          </select>
        </label>
        <label>Status
          <select id="t-status">
            ${["Draft","Assigned","Tested","Commissioned"].map(s => `<option ${tag.status===s?"selected":""}>${s}</option>`).join("")}
          </select>
        </label>
      </div>
      <label>Notes <textarea id="t-notes" rows="2">${tag.notes || ""}</textarea></label>
    `;
    
    modalFooter.innerHTML = `
      <button class="btn btn-ghost" id="t-cancel">Cancel</button>
      <button class="btn btn-primary" id="t-save">Save Tag</button>
    `;
    modalOverlay.classList.remove("hidden");

    document.getElementById("t-cancel").addEventListener("click", () => modalOverlay.classList.add("hidden"));
    document.getElementById("t-save").addEventListener("click", async () => {
      const tagName = document.getElementById("t-name").value.trim();
      if (!tagName) { alert("Tag Name is required"); return; }
      
      const newTag = {
        id: tag.id || crypto.randomUUID(),
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

  // Event Listeners
  document.getElementById("add-io-btn").addEventListener("click", () => openIoModal());
  searchInput.addEventListener("input", renderIoTable);
  typeFilter.addEventListener("change", renderIoTable);

  // Export to CSV
  document.getElementById("io-export-btn").addEventListener("click", () => {
    if (ioTags.length === 0) return;
    const headers = ["Tag Name", "Description", "Type", "PLC Address", "HMI Screen", "Priority", "Status", "Notes"];
    const rows = ioTags.map(t => [
      t.tagName, t.description, t.type, t.plcAddress, t.hmiScreen, t.priority, t.status, t.notes
    ].map(v => `"${(v||"").replace(/"/g, '""')}"`).join(","));
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = encodeURI(csvContent);
    a.download = `agc-io-list-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  });

  // Import from CSV
  document.getElementById("io-import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const lines = event.target.result.split("\n").filter(l => l.trim() !== "");
      if (lines.length < 2) return;
      
      // Assumes standard format matching the export
      for (let i = 1; i < lines.length; i++) {
        // Simple regex to split by comma outside of quotes
        const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"\vert{}"$/g, "").trim());
        if (cols[0]) {
          await DB.put("io_tags", {
            id: crypto.randomUUID(),
            tagName: cols[0], description: cols[1], type: cols[2], plcAddress: cols[3],
            hmiScreen: cols[4], priority: cols[5], status: cols[6], notes: cols[7]
          });
        }
      }
      ioTags = await DB.getAll("io_tags");
      renderIoTable();
      e.target.value = ""; // Reset input
    };
    reader.readAsText(file);
  });

  // Check if DB is ready before initial load
  setTimeout(initIo, 200); 
});

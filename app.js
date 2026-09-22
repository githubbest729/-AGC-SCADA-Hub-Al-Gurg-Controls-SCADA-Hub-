/* =========================================================
   AGC SCADA Hub — app.js
   Vanilla JS SPA logic: tabs, requirements matrix,
   cost estimation engine, execution kanban board,
   localStorage persistence, offline handling.
   ========================================================= */

(() => {
  "use strict";

  /* ---------------- Storage Keys ---------------- */
  const STORE_KEY = "agc_scada_hub_data_v1";

  /* ---------------- Default Data Model ---------------- */
  function defaultData() {
    return {
      requirements: [],
      estimates: [],      // saved costing sheets
      currentEstimate: newEstimate(),
      tasks: [],
      meta: { lastSaved: null }
    };
  }

  function newEstimate() {
    return {
      id: null,
      name: "",
      client: "",
      currency: "AED",
      rate: 150,
      contingency: 10,
      margin: 15,
      engHours: 0,
      boq: [],
      savedAt: null
    };
  }

  const PHASES = ["Design", "Programming", "FAT", "Commissioning", "SAT"];
  const REQ_STATUSES = ["Open", "In Progress", "Blocked", "Delivered"];
  const BOQ_CATEGORIES = ["PLC", "SCADA Tags", "I/O Module", "Network Switch", "HMI Panel", "Server/Workstation", "Cabling", "Software License", "Other"];
  const BOQ_UNITS = ["pcs", "tags", "pts", "m", "lot", "hrs"];

  /* ---------------- State ---------------- */
  let DATA = loadData();

  function loadData() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      // merge with defaults to protect against missing keys after updates
      const d = defaultData();
      return Object.assign(d, parsed, {
        currentEstimate: Object.assign(newEstimate(), parsed.currentEstimate || {})
      });
    } catch (e) {
      console.error("Failed to load local data, starting fresh.", e);
      return defaultData();
    }
  }

  function saveData() {
    DATA.meta.lastSaved = new Date().toISOString();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(DATA));
      flashSyncStatus(true);
    } catch (e) {
      console.error("Save failed", e);
      flashSyncStatus(false);
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function fmtMoney(n, currency) {
    const val = isFinite(n) ? n : 0;
    return `${currency || DATA.currentEstimate.currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  /* ---------------- Sync / Offline status ---------------- */
  const syncStatusEl = document.getElementById("sync-status");
  const offlineBanner = document.getElementById("offline-banner");

  function flashSyncStatus(ok) {
    if (!syncStatusEl) return;
    syncStatusEl.textContent = ok ? "● Saved locally" : "● Save failed";
    syncStatusEl.classList.toggle("offline", !ok);
  }

  function updateOnlineStatus() {
    const online = navigator.onLine;
    offlineBanner.classList.toggle("hidden", online);
  }
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);

  /* ---------------- Tabs ---------------- */
  const tabBtns = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle("active", b === btn));
      panels.forEach(p => p.classList.toggle("active", p.id === `panel-${tab}`));
      if (tab === "dashboard") renderDashboard();
      if (tab === "requirements") renderRequirements();
      if (tab === "estimation") renderEstimation();
      if (tab === "execution") renderKanban();
    });
  });

  /* ---------------- Modal helper ---------------- */
  const modalOverlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalFooter = document.getElementById("modal-footer");

  function openModal({ title, bodyHtml, footerButtons }) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modalFooter.innerHTML = "";
    (footerButtons || []).forEach(btnDef => {
      const b = document.createElement("button");
      b.className = btnDef.className || "btn";
      b.textContent = btnDef.label;
      b.addEventListener("click", btnDef.onClick);
      modalFooter.appendChild(b);
    });
    modalOverlay.classList.remove("hidden");
  }
  function closeModal() {
    modalOverlay.classList.add("hidden");
  }
  document.getElementById("modal-close").addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });

  /* =========================================================
     DASHBOARD
     ========================================================= */
  function renderDashboard() {
    const statGrid = document.getElementById("dashboard-stats");
    const openReqs = DATA.requirements.filter(r => r.status !== "Delivered").length;
    const blocked = DATA.requirements.filter(r => r.status === "Blocked").length;
    const totalTasks = DATA.tasks.length;
    const satCount = DATA.tasks.filter(t => t.phase === "SAT").length;
    const estTotal = DATA.estimates.reduce((sum, e) => sum + (calcTotals(e).grandTotal || 0), 0);

    statGrid.innerHTML = "";
    const stats = [
      { label: "Open Requirements", value: openReqs },
      { label: "Blocked Items", value: blocked },
      { label: "Execution Tasks", value: totalTasks },
      { label: "Tasks in SAT", value: satCount },
      { label: "Saved Costing Sheets", value: DATA.estimates.length },
      { label: "Total Estimated Value", value: `${DATA.currentEstimate.currency} ${Math.round(estTotal).toLocaleString()}` }
    ];
    stats.forEach(s => {
      const box = document.createElement("div");
      box.className = "stat-box";
      box.innerHTML = `<div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div>`;
      statGrid.appendChild(box);
    });

    // Open requirements mini list
    const reqList = document.getElementById("dash-requirements-list");
    const openList = DATA.requirements.filter(r => r.status !== "Delivered").slice(0, 6);
    reqList.innerHTML = openList.length
      ? openList.map(r => `<div class="mini-row"><span>${escapeHtml(r.title)}</span><span class="muted">${r.status}</span></div>`).join("")
      : `<p class="muted">No open requirements.</p>`;

    // Execution snapshot
    const execSnap = document.getElementById("dash-execution-snapshot");
    execSnap.innerHTML = PHASES.map(p => {
      const count = DATA.tasks.filter(t => t.phase === p).length;
      return `<div class="mini-row"><span>${p}</span><span class="muted">${count} task${count === 1 ? "" : "s"}</span></div>`;
    }).join("");

    // Recent estimates
    const estList = document.getElementById("dash-estimates-list");
    const recent = [...DATA.estimates].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)).slice(0, 5);
    estList.innerHTML = recent.length
      ? recent.map(e => `<div class="mini-row"><span>${escapeHtml(e.name || "Untitled")}</span><span class="muted">${fmtMoney(calcTotals(e).grandTotal, e.currency)}</span></div>`).join("")
      : `<p class="muted">No costing sheets saved yet.</p>`;
  }

  /* =========================================================
     REQUIREMENTS & STAKEHOLDER MATRIX
     ========================================================= */
  const reqTbody = document.getElementById("requirements-tbody");
  const reqEmpty = document.getElementById("requirements-empty");
  const reqSearch = document.getElementById("req-search");
  const reqStatusFilter = document.getElementById("req-status-filter");

  document.getElementById("add-requirement-btn").addEventListener("click", () => openRequirementModal());
  reqSearch.addEventListener("input", renderRequirements);
  reqStatusFilter.addEventListener("change", renderRequirements);

  function statusBadgeClass(status) {
    return {
      "Open": "badge-open",
      "In Progress": "badge-progress",
      "Blocked": "badge-blocked",
      "Delivered": "badge-delivered"
    }[status] || "badge-open";
  }
  function priorityBadgeClass(p) {
    return { High: "badge-high", Medium: "badge-medium", Low: "badge-low" }[p] || "badge-medium";
  }

  function renderRequirements() {
    const q = (reqSearch.value || "").toLowerCase();
    const statusF = reqStatusFilter.value;
    const rows = DATA.requirements.filter(r => {
      const matchesQ = !q || [r.project, r.title, r.stakeholder].some(f => (f || "").toLowerCase().includes(q));
      const matchesStatus = !statusF || r.status === statusF;
      return matchesQ && matchesStatus;
    });

    reqTbody.innerHTML = "";
    reqEmpty.classList.toggle("hidden", DATA.requirements.length !== 0);

    rows.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(r.project)}</td>
        <td>${escapeHtml(r.title)}</td>
        <td>${escapeHtml(r.stakeholder)}</td>
        <td>${escapeHtml(r.role)}</td>
        <td><span class="badge ${priorityBadgeClass(r.priority)}">${r.priority}</span></td>
        <td><span class="badge ${statusBadgeClass(r.status)}">${r.status}</span></td>
        <td>${fmtDate(r.due)}</td>
        <td>
          <button class="btn-icon" data-edit="${r.id}" title="Edit">✎</button>
          <button class="btn-icon" data-del="${r.id}" title="Delete">🗑</button>
        </td>
      `;
      reqTbody.appendChild(tr);
    });

    reqTbody.querySelectorAll("[data-edit]").forEach(b =>
      b.addEventListener("click", () => openRequirementModal(b.dataset.edit)));
    reqTbody.querySelectorAll("[data-del]").forEach(b =>
      b.addEventListener("click", () => {
        if (confirm("Delete this requirement?")) {
          DATA.requirements = DATA.requirements.filter(r => r.id !== b.dataset.del);
          saveData(); renderRequirements();
        }
      }));
  }

  function openRequirementModal(id) {
    const existing = id ? DATA.requirements.find(r => r.id === id) : null;
    const r = existing || { id: null, project: "", title: "", stakeholder: "", role: "Project Manager", priority: "Medium", status: "Open", due: "", notes: "" };

    const bodyHtml = `
      <label>Project<input type="text" id="f-project" value="${escapeAttr(r.project)}" placeholder="e.g. Jebel Ali Pump Station"/></label>
      <label>Requirement<input type="text" id="f-title" value="${escapeAttr(r.title)}" placeholder="Describe the requirement"/></label>
      <label>Stakeholder Name<input type="text" id="f-stakeholder" value="${escapeAttr(r.stakeholder)}" placeholder="e.g. Ahmed Al Farsi"/></label>
      <label>Stakeholder Role
        <select id="f-role">
          ${["Project Manager","Control System Engineer","Client","Estimation Team","SCADA Engineer","Other"].map(role =>
            `<option ${r.role === role ? "selected" : ""}>${role}</option>`).join("")}
        </select>
      </label>
      <label>Priority
        <select id="f-priority">
          ${["High","Medium","Low"].map(p => `<option ${r.priority===p?"selected":""}>${p}</option>`).join("")}
        </select>
      </label>
      <label>Status
        <select id="f-status">
          ${REQ_STATUSES.map(s => `<option ${r.status===s?"selected":""}>${s}</option>`).join("")}
        </select>
      </label>
      <label>Due Date<input type="date" id="f-due" value="${r.due || ""}"/></label>
      <label>Notes<textarea id="f-notes" rows="3">${escapeHtml(r.notes || "")}</textarea></label>
    `;

    openModal({
      title: existing ? "Edit Requirement" : "New Requirement",
      bodyHtml,
      footerButtons: [
        { label: "Cancel", className: "btn btn-ghost", onClick: closeModal },
        {
          label: "Save", className: "btn btn-primary", onClick: () => {
            const title = document.getElementById("f-title").value.trim();
            if (!title) { alert("Requirement description is required."); return; }
            const updated = {
              id: r.id || uid(),
              project: document.getElementById("f-project").value.trim(),
              title,
              stakeholder: document.getElementById("f-stakeholder").value.trim(),
              role: document.getElementById("f-role").value,
              priority: document.getElementById("f-priority").value,
              status: document.getElementById("f-status").value,
              due: document.getElementById("f-due").value,
              notes: document.getElementById("f-notes").value.trim()
            };
            if (existing) {
              const idx = DATA.requirements.findIndex(x => x.id === r.id);
              DATA.requirements[idx] = updated;
            } else {
              DATA.requirements.push(updated);
            }
            saveData();
            closeModal();
            renderRequirements();
          }
        }
      ]
    });
  }

  /* =========================================================
     COST ESTIMATION ENGINE
     ========================================================= */
  const estNameEl = document.getElementById("est-name");
  const estClientEl = document.getElementById("est-client");
  const estCurrencyEl = document.getElementById("est-currency");
  const estRateEl = document.getElementById("est-rate");
  const estContingencyEl = document.getElementById("est-contingency");
  const estMarginEl = document.getElementById("est-margin");
  const estEngHoursEl = document.getElementById("est-eng-hours");
  const boqTbody = document.getElementById("boq-tbody");
  const costSummaryEl = document.getElementById("cost-summary");
  const estimatesTbody = document.getElementById("estimates-tbody");

  [estNameEl, estClientEl, estCurrencyEl, estRateEl, estContingencyEl, estMarginEl, estEngHoursEl].forEach(el => {
    el.addEventListener("input", () => { syncEstimateFromForm(); renderCostSummary(); saveData(); });
    el.addEventListener("change", () => { syncEstimateFromForm(); renderCostSummary(); saveData(); });
  });

  document.getElementById("add-boq-row").addEventListener("click", () => {
    DATA.currentEstimate.boq.push({ id: uid(), category: BOQ_CATEGORIES[0], description: "", qty: 1, unit: BOQ_UNITS[0], unitCost: 0 });
    saveData();
    renderBoqTable();
    renderCostSummary();
  });

  document.getElementById("new-estimate-btn").addEventListener("click", () => {
    if (DATA.currentEstimate.boq.length && !confirm("Start a new blank costing sheet? Unsaved changes to the current sheet will be lost unless already saved.")) return;
    DATA.currentEstimate = newEstimate();
    saveData();
    renderEstimation();
  });

  document.getElementById("print-estimate-btn").addEventListener("click", () => {
    syncEstimateFromForm();
    window.print();
  });

  function syncEstimateFromForm() {
    const e = DATA.currentEstimate;
    e.name = estNameEl.value;
    e.client = estClientEl.value;
    e.currency = estCurrencyEl.value;
    e.rate = parseFloat(estRateEl.value) || 0;
    e.contingency = parseFloat(estContingencyEl.value) || 0;
    e.margin = parseFloat(estMarginEl.value) || 0;
    e.engHours = parseFloat(estEngHoursEl.value) || 0;
  }

  function calcTotals(estimate) {
    const boqTotal = (estimate.boq || []).reduce((sum, item) => sum + (item.qty * item.unitCost), 0);
    const engCost = (estimate.engHours || 0) * (estimate.rate || 0);
    const subtotal = boqTotal + engCost;
    const contingencyAmt = subtotal * ((estimate.contingency || 0) / 100);
    const afterContingency = subtotal + contingencyAmt;
    const marginAmt = afterContingency * ((estimate.margin || 0) / 100);
    const grandTotal = afterContingency + marginAmt;
    return { boqTotal, engCost, subtotal, contingencyAmt, marginAmt, grandTotal };
  }

  function renderBoqTable() {
    const boq = DATA.currentEstimate.boq;
    boqTbody.innerHTML = "";
    boq.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <select data-field="category" data-id="${item.id}">
            ${BOQ_CATEGORIES.map(c => `<option ${item.category===c?"selected":""}>${c}</option>`).join("")}
          </select>
        </td>
        <td><input type="text" class="boq-input" style="min-width:140px" data-field="description" data-id="${item.id}" value="${escapeAttr(item.description)}" placeholder="Description / tag name"/></td>
        <td><input type="number" class="boq-input" data-field="qty" data-id="${item.id}" value="${item.qty}" min="0" step="1"/></td>
        <td>
          <select data-field="unit" data-id="${item.id}">
            ${BOQ_UNITS.map(u => `<option ${item.unit===u?"selected":""}>${u}</option>`).join("")}
          </select>
        </td>
        <td><input type="number" class="boq-input" data-field="unitCost" data-id="${item.id}" value="${item.unitCost}" min="0" step="0.01"/></td>
        <td>${fmtMoney(item.qty * item.unitCost, DATA.currentEstimate.currency)}</td>
        <td><button class="btn-icon" data-del-boq="${item.id}" title="Remove">🗑</button></td>
      `;
      boqTbody.appendChild(tr);
    });

    boqTbody.querySelectorAll("[data-field]").forEach(el => {
      el.addEventListener("input", handleBoqFieldChange);
      el.addEventListener("change", handleBoqFieldChange);
    });
    boqTbody.querySelectorAll("[data-del-boq]").forEach(b =>
      b.addEventListener("click", () => {
        DATA.currentEstimate.boq = DATA.currentEstimate.boq.filter(i => i.id !== b.dataset.delBoq);
        saveData();
        renderBoqTable();
        renderCostSummary();
      }));
  }

  function handleBoqFieldChange(e) {
    const id = e.target.dataset.id;
    const field = e.target.dataset.field;
    const item = DATA.currentEstimate.boq.find(i => i.id === id);
    if (!item) return;
    if (field === "qty" || field === "unitCost") {
      item[field] = parseFloat(e.target.value) || 0;
    } else {
      item[field] = e.target.value;
    }
    saveData();
    renderBoqTable();
    renderCostSummary();
  }

  function renderCostSummary() {
    const e = DATA.currentEstimate;
    const t = calcTotals(e);
    costSummaryEl.innerHTML = `
      <div class="row"><span>BOQ Materials Subtotal</span><span>${fmtMoney(t.boqTotal, e.currency)}</span></div>
      <div class="row"><span>Engineering Hours (${e.engHours} hrs × ${fmtMoney(e.rate, e.currency)})</span><span>${fmtMoney(t.engCost, e.currency)}</span></div>
      <div class="row"><span>Subtotal</span><span>${fmtMoney(t.subtotal, e.currency)}</span></div>
      <div class="row"><span>Contingency (${e.contingency}%)</span><span>${fmtMoney(t.contingencyAmt, e.currency)}</span></div>
      <div class="row"><span>Margin (${e.margin}%)</span><span>${fmtMoney(t.marginAmt, e.currency)}</span></div>
      <div class="row grand-total"><span>Grand Total</span><span>${fmtMoney(t.grandTotal, e.currency)}</span></div>
      <button class="btn btn-primary" id="save-estimate-btn" style="margin-top:10px;">💾 Save Costing Sheet</button>
    `;
    document.getElementById("save-estimate-btn").addEventListener("click", saveCurrentEstimate);
  }

  function saveCurrentEstimate() {
    syncEstimateFromForm();
    const e = DATA.currentEstimate;
    if (!e.name.trim()) { alert("Please name this costing sheet before saving."); return; }
    e.savedAt = new Date().toISOString();
    if (!e.id) e.id = uid();

    const idx = DATA.estimates.findIndex(x => x.id === e.id);
    const clone = JSON.parse(JSON.stringify(e));
    if (idx >= 0) DATA.estimates[idx] = clone;
    else DATA.estimates.push(clone);

    saveData();
    renderEstimatesTable();
    renderDashboard();
    alert("Costing sheet saved.");
  }

  function renderEstimatesTable() {
    estimatesTbody.innerHTML = "";
    DATA.estimates.forEach(e => {
      const t = calcTotals(e);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(e.name)}</td>
        <td>${escapeHtml(e.client || "—")}</td>
        <td>${fmtMoney(t.grandTotal, e.currency)}</td>
        <td>${fmtDate(e.savedAt)}</td>
        <td>
          <button class="btn-icon" data-load="${e.id}" title="Load into editor">📂</button>
          <button class="btn-icon" data-del-est="${e.id}" title="Delete">🗑</button>
        </td>
      `;
      estimatesTbody.appendChild(tr);
    });
    estimatesTbody.querySelectorAll("[data-load]").forEach(b =>
      b.addEventListener("click", () => {
        const found = DATA.estimates.find(x => x.id === b.dataset.load);
        if (found) {
          DATA.currentEstimate = JSON.parse(JSON.stringify(found));
          saveData();
          renderEstimation();
        }
      }));
    estimatesTbody.querySelectorAll("[data-del-est]").forEach(b =>
      b.addEventListener("click", () => {
        if (confirm("Delete this saved costing sheet?")) {
          DATA.estimates = DATA.estimates.filter(x => x.id !== b.dataset.delEst);
          saveData();
          renderEstimatesTable();
          renderDashboard();
        }
      }));
  }

  function renderEstimation() {
    const e = DATA.currentEstimate;
    estNameEl.value = e.name || "";
    estClientEl.value = e.client || "";
    estCurrencyEl.value = e.currency || "AED";
    estRateEl.value = e.rate;
    estContingencyEl.value = e.contingency;
    estMarginEl.value = e.margin;
    estEngHoursEl.value = e.engHours;
    renderBoqTable();
    renderCostSummary();
    renderEstimatesTable();
  }

  /* =========================================================
     EXECUTION BOARD (Kanban)
     ========================================================= */
  const kanbanBoard = document.getElementById("kanban-board");

  document.getElementById("add-task-btn").addEventListener("click", () => openTaskModal());

  function openTaskModal(id) {
    const existing = id ? DATA.tasks.find(t => t.id === id) : null;
    const t = existing || { id: null, title: "", project: "", owner: "", team: "Programming Team", phase: "Design", notes: "" };

    const bodyHtml = `
      <label>Task Title<input type="text" id="k-title" value="${escapeAttr(t.title)}" placeholder="e.g. Configure Modbus TCP driver"/></label>
      <label>Project<input type="text" id="k-project" value="${escapeAttr(t.project)}" placeholder="Project name"/></label>
      <label>Owner<input type="text" id="k-owner" value="${escapeAttr(t.owner)}" placeholder="Assigned engineer"/></label>
      <label>Team
        <select id="k-team">
          ${["Design Team","Programming Team","Panel Shop","Commissioning Team","Client Team","QA/FAT Team"].map(tm =>
            `<option ${t.team===tm?"selected":""}>${tm}</option>`).join("")}
        </select>
      </label>
      <label>Phase
        <select id="k-phase">
          ${PHASES.map(p => `<option ${t.phase===p?"selected":""}>${p}</option>`).join("")}
        </select>
      </label>
      <label>Notes<textarea id="k-notes" rows="3">${escapeHtml(t.notes || "")}</textarea></label>
    `;

    openModal({
      title: existing ? "Edit Task" : "New Execution Task",
      bodyHtml,
      footerButtons: [
        { label: "Cancel", className: "btn btn-ghost", onClick: closeModal },
        {
          label: "Save", className: "btn btn-primary", onClick: () => {
            const title = document.getElementById("k-title").value.trim();
            if (!title) { alert("Task title is required."); return; }
            const updated = {
              id: t.id || uid(),
              title,
              project: document.getElementById("k-project").value.trim(),
              owner: document.getElementById("k-owner").value.trim(),
              team: document.getElementById("k-team").value,
              phase: document.getElementById("k-phase").value,
              notes: document.getElementById("k-notes").value.trim()
            };
            if (existing) {
              const idx = DATA.tasks.findIndex(x => x.id === t.id);
              DATA.tasks[idx] = updated;
            } else {
              DATA.tasks.push(updated);
            }
            saveData();
            closeModal();
            renderKanban();
          }
        }
      ]
    });
  }

  function moveTask(taskId, direction) {
    const t = DATA.tasks.find(x => x.id === taskId);
    if (!t) return;
    const idx = PHASES.indexOf(t.phase);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= PHASES.length) return;
    t.phase = PHASES[newIdx];
    saveData();
    renderKanban();
  }

  let dragTaskId = null;

  function renderKanban() {
    kanbanBoard.innerHTML = "";
    PHASES.forEach(phase => {
      const col = document.createElement("div");
      col.className = "kanban-col";
      col.dataset.phase = phase;

      const tasksInPhase = DATA.tasks.filter(t => t.phase === phase);
      col.innerHTML = `
        <div class="kanban-col-header"><span>${phase}</span><span class="kanban-count">${tasksInPhase.length}</span></div>
        <div class="kanban-cards" data-phase="${phase}"></div>
      `;

      const cardsWrap = col.querySelector(".kanban-cards");
      tasksInPhase.forEach(t => {
        const card = document.createElement("div");
        card.className = "kanban-card";
        card.draggable = true;
        card.dataset.id = t.id;
        const phaseIdx = PHASES.indexOf(t.phase);
        card.innerHTML = `
          <div class="kc-title">${escapeHtml(t.title)}</div>
          <div>${escapeHtml(t.project || "")}</div>
          <div class="kc-meta"><span>${escapeHtml(t.team)}</span><span>${escapeHtml(t.owner || "Unassigned")}</span></div>
          <div class="kc-actions">
            <span>
              <button class="btn-icon" data-move-left ${phaseIdx===0?"disabled":""} title="Move back">◀</button>
              <button class="btn-icon" data-move-right ${phaseIdx===PHASES.length-1?"disabled":""} title="Move forward">▶</button>
            </span>
            <span>
              <button class="btn-icon" data-edit-task title="Edit">✎</button>
              <button class="btn-icon" data-del-task title="Delete">🗑</button>
            </span>
          </div>
        `;

        card.addEventListener("dragstart", () => { dragTaskId = t.id; card.classList.add("dragging"); });
        card.addEventListener("dragend", () => { card.classList.remove("dragging"); });

        card.querySelector("[data-move-left]").addEventListener("click", () => moveTask(t.id, -1));
        card.querySelector("[data-move-right]").addEventListener("click", () => moveTask(t.id, 1));
        card.querySelector("[data-edit-task]").addEventListener("click", () => openTaskModal(t.id));
        card.querySelector("[data-del-task]").addEventListener("click", () => {
          if (confirm("Delete this task?")) {
            DATA.tasks = DATA.tasks.filter(x => x.id !== t.id);
            saveData();
            renderKanban();
          }
        });

        cardsWrap.appendChild(card);
      });

      col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
      col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
      col.addEventListener("drop", (e) => {
        e.preventDefault();
        col.classList.remove("drag-over");
        if (dragTaskId) {
          const t = DATA.tasks.find(x => x.id === dragTaskId);
          if (t) { t.phase = phase; saveData(); renderKanban(); }
        }
      });

      kanbanBoard.appendChild(col);
    });
  }

  /* =========================================================
     EXPORT / SETTINGS
     ========================================================= */
  document.getElementById("export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agc-scada-hub-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("settings-btn").addEventListener("click", () => {
    openModal({
      title: "Settings & About",
      bodyHtml: `
        <p><strong>AGC SCADA Hub</strong> — v1.0</p>
        <p style="margin-top:8px;">Al Gurg Automation and Controls</p>
        <p style="color:var(--slate-400); font-size:0.8rem; margin-top:4px;">
          Al Ittihad Road (Dubai-Sharjah Road), Al Khabisi Area, Deira, PO Box 25490, Dubai, UAE
        </p>
        <p style="margin-top:14px; font-size:0.85rem;">All data is stored locally on this device (localStorage) so the app works fully offline on-site. Use <em>Export</em> to back up or transfer your data.</p>
        <button class="btn btn-danger" id="clear-data-btn" style="margin-top:14px;">Clear All Local Data</button>
      `,
      footerButtons: [{ label: "Close", className: "btn btn-primary", onClick: closeModal }]
    });
    document.getElementById("clear-data-btn").addEventListener("click", () => {
      if (confirm("This will permanently delete all locally stored data on this device. Continue?")) {
        localStorage.removeItem(STORE_KEY);
        DATA = defaultData();
        closeModal();
        renderAll();
      }
    });
  });

  /* ---------------- Utilities ---------------- */
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function escapeAttr(str) { return escapeHtml(str); }

  /* ---------------- Init ---------------- */
  function renderAll() {
    renderDashboard();
    renderRequirements();
    renderEstimation();
    renderKanban();
  }

  function init() {
    updateOnlineStatus();
    renderAll();

    // Register service worker for offline caching
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch(err => {
          console.warn("Service worker registration failed:", err);
        });
      });
    }
  }

  init();
})();

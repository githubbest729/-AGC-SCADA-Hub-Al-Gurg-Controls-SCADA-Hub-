/* =========================================================
   AGC SCADA Hub — app.js
   Vanilla JS SPA logic (Upgraded to IndexedDB)
   Tabs, requirements matrix, cost estimation engine, 
   execution kanban board, offline handling.
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  /* ---------------- 1. Initialize DB & Seed ---------------- */
  await DB.init();

  const projects = await DB.getAll("projects");
  if (projects.length === 0) {
    try {
      const response = await fetch("./data/sample-project.json");
      if (response.ok) {
        const sampleData = await response.json();
        await DB.seedData(sampleData);
      }
    } catch (error) {
      console.warn("Could not load sample data", error);
    }
  }

  /* ---------------- 2. State & Database Sync ---------------- */
  const DATA = {
    requirements: [],
    tasks: [],
    estimates: [],
    currentEstimate: newEstimate()
  };

  // Load draft estimate from local storage (keeps in-progress work safe if you refresh)
  const draft = localStorage.getItem("agc_draft_estimate");
  if (draft) {
    try {
      DATA.currentEstimate = Object.assign(newEstimate(), JSON.parse(draft));
    } catch(e) {}
  }

  // Master function to sync local state with IndexedDB
  async function refreshData() {
    DATA.requirements = await DB.getAll("requirements");
    DATA.tasks = await DB.getAll("kanban");
    DATA.estimates = await DB.getAll("estimates");
  }

  await refreshData(); // Initial load

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

  // Save in-progress estimate to localStorage (drafts don't need IndexedDB yet)
  function saveDraft() {
    try {
      localStorage.setItem("agc_draft_estimate", JSON.stringify(DATA.currentEstimate));
      flashSyncStatus(true);
    } catch (e) {
      flashSyncStatus(false);
    }
  }

  const PHASES = ["Design", "Programming", "FAT", "Commissioning", "SAT"];
  const REQ_STATUSES = ["Open", "In Progress", "Blocked", "Delivered"];

  const FALLBACK_CATEGORIES = ["PLC", "SCADA Tags", "I/O Module", "Network Switch", "HMI Panel", "Server/Workstation", "Cabling", "Software License", "Other"];
  const FALLBACK_UNITS = ["pcs", "tags", "pts", "m", "lot", "hrs"];

  /* ---------------- BOQ Catalog ---------------- */
  const CATALOG_CACHE_KEY = "agc_scada_hub_catalog_cache_v1";
  let CATALOG = null;

  async function loadCatalog() {
    try {
      const res = await fetch("data/boq-catalog.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      CATALOG = await res.json();
      try { localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(CATALOG)); } catch (e) {}
    } catch (err) {
      console.warn("Could not fetch data/boq-catalog.json, trying local cache.", err);
      try {
        const cached = localStorage.getItem(CATALOG_CACHE_KEY);
        if (cached) CATALOG = JSON.parse(cached);
      } catch (e) {}
    }
  }

  function getCategoryLabels() {
    if (CATALOG && Array.isArray(CATALOG.categories) && CATALOG.categories.length) return CATALOG.categories.map(c => c.label);
    return FALLBACK_CATEGORIES;
  }

  function getUnitsForCategory(categoryLabel) {
    if (CATALOG && Array.isArray(CATALOG.categories)) {
      const cat = CATALOG.categories.find(c => c.label === categoryLabel);
      if (cat && cat.unit) return [cat.unit, ...FALLBACK_UNITS.filter(u => u !== cat.unit)];
    }
    return FALLBACK_UNITS;
  }

  function getCatalogItemsForCategory(categoryLabel) {
    if (CATALOG && Array.isArray(CATALOG.categories)) {
      const cat = CATALOG.categories.find(c => c.label === categoryLabel);
      if (cat) return cat.items || [];
    }
    return [];
  }

  function getEngineeringRates() {
    if (CATALOG && CATALOG.engineeringRates && Array.isArray(CATALOG.engineeringRates.rates)) return CATALOG.engineeringRates.rates;
    return [];
  }

  /* ---------------- Utilities ---------------- */
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

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function escapeAttr(str) { return escapeHtml(str); }

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

    const reqList = document.getElementById("dash-requirements-list");
    const openList = DATA.requirements.filter(r => r.status !== "Delivered").slice(0, 6);
    reqList.innerHTML = openList.length
      ? openList.map(r => `<div class="mini-row"><span>${escapeHtml(r.title)}</span><span class="muted">${r.status}</span></div>`).join("")
      : `<p class="muted">No open requirements.</p>`;

    const execSnap = document.getElementById("dash-execution-snapshot");
    execSnap.innerHTML = PHASES.map(p => {
      const count = DATA.tasks.filter(t => t.phase === p).length;
      return `<div class="mini-row"><span>${p}</span><span class="muted">${count} task${count === 1 ? "" : "s"}</span></div>`;
    }).join("");

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
    return { "Open": "badge-open", "In Progress": "badge-progress", "Blocked": "badge-blocked", "Delivered": "badge-delivered" }[status] || "badge-open";
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

    reqTbody.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openRequirementModal(b.dataset.edit)));
    reqTbody.querySelectorAll("[data-del]").forEach(b =>
      b.addEventListener("click", async () => {
        if (confirm("Delete this requirement?")) {
          await DB.delete("requirements", b.dataset.del);
          await refreshData();
          renderRequirements();
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
          ${["Project Manager","Control System Engineer","Client","Estimation Team","SCADA Engineer","Other"].map(role => `<option ${r.role === role ? "selected" : ""}>${role}</option>`).join("")}
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
          label: "Save", className: "btn btn-primary", onClick: async () => {
            const title = document.getElementById("f-title").value.trim();
            if (!title) { alert("Requirement description is required."); return; }
            
            const updated = {
              id: r.id || crypto.randomUUID(),
              project: document.getElementById("f-project").value.trim(),
              title,
              stakeholder: document.getElementById("f-stakeholder").value.trim(),
              role: document.getElementById("f-role").value,
              priority: document.getElementById("f-priority").value,
              status: document.getElementById("f-status").value,
              due: document.getElementById("f-due").value,
              notes: document.getElementById("f-notes").value.trim()
            };
            
            await DB.put("requirements", updated);
            await refreshData();
            closeModal();
            renderRequirements();
            flashSyncStatus(true);
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
  const estRoleEl = document.getElementById("est-role");
  const estContingencyEl = document.getElementById("est-contingency");
  const estMarginEl = document.getElementById("est-margin");
  const estEngHoursEl = document.getElementById("est-eng-hours");
  const boqTbody = document.getElementById("boq-tbody");
  const costSummaryEl = document.getElementById("cost-summary");
  const estimatesTbody = document.getElementById("estimates-tbody");

  [estNameEl, estClientEl, estCurrencyEl, estRateEl, estContingencyEl, estMarginEl, estEngHoursEl].forEach(el => {
    el.addEventListener("input", () => { syncEstimateFromForm(); renderCostSummary(); saveDraft(); });
    el.addEventListener("change", () => { syncEstimateFromForm(); renderCostSummary(); saveDraft(); });
  });

  estRoleEl.addEventListener("change", () => {
    const rates = getEngineeringRates();
    const match = rates.find(r => r.role === estRoleEl.value);
    if (match) {
      estRateEl.value = match.hourlyRate;
      syncEstimateFromForm();
      renderCostSummary();
      saveDraft();
    }
  });

  function populateRoleDropdown() {
    const rates = getEngineeringRates();
    if (!rates.length) {
      estRoleEl.innerHTML = `<option value="">Catalog not loaded</option>`;
      estRoleEl.disabled = true;
      return;
    }
    estRoleEl.disabled = false;
    estRoleEl.innerHTML = `<option value="">— Custom rate —</option>` +
      rates.map(r => `<option value="${escapeAttr(r.role)}">${escapeHtml(r.role)} (${fmtMoney(r.hourlyRate, (CATALOG && CATALOG.currency) || "AED")}/hr)</option>`).join("");
  }

  document.getElementById("add-boq-row").addEventListener("click", () => {
    const defaultCategory = getCategoryLabels()[0];
    DATA.currentEstimate.boq.push({
      id: crypto.randomUUID(), category: defaultCategory, catalogSku: "",
      description: "", qty: 1, unit: getUnitsForCategory(defaultCategory)[0], unitCost: 0
    });
    saveDraft();
    renderBoqTable();
    renderCostSummary();
  });

  document.getElementById("new-estimate-btn").addEventListener("click", () => {
    if (DATA.currentEstimate.boq.length && !confirm("Start a new blank costing sheet? Unsaved changes will be lost.")) return;
    DATA.currentEstimate = newEstimate();
    saveDraft();
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
    const categories = getCategoryLabels();
    boqTbody.innerHTML = "";
    
    boq.forEach(item => {
      const catalogItems = getCatalogItemsForCategory(item.category);
      const units = getUnitsForCategory(item.category);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <select data-field="category" data-id="${item.id}">
            ${categories.map(c => `<option ${item.category===c?"selected":""}>${c}</option>`).join("")}
          </select>
        </td>
        <td>
          <select data-field="catalogSku" data-id="${item.id}" ${catalogItems.length ? "" : "disabled"}>
            <option value="">${catalogItems.length ? "— Select catalog item —" : "No catalog items"}</option>
            ${catalogItems.map(ci => `<option value="${escapeAttr(ci.sku)}" ${item.catalogSku===ci.sku?"selected":""}>${escapeHtml(ci.vendor)} —${escapeHtml(ci.description)}</option>`).join("")}
          </select>
        </td>
        <td><input type="text" class="boq-input" style="min-width:140px" data-field="description" data-id="${item.id}" value="${escapeAttr(item.description)}" placeholder="Description / tag name"/></td>
        <td><input type="number" class="boq-input" data-field="qty" data-id="${item.id}" value="${item.qty}" min="0" step="1"/></td>
        <td>
          <select data-field="unit" data-id="${item.id}">
            ${units.map(u => `<option ${item.unit===u?"selected":""}>${u}</option>`).join("")}
          </select>
        </td>
        <td><input type="number" class="boq-input" data-field="unitCost" data-id="${item.id}" value="${item.unitCost}" min="0" step="0.01"/></td>
        <td>${fmtMoney(item.qty * item.unitCost, DATA.currentEstimate.currency)}</td>
        <td><button class="btn-icon" data-del-boq="${item.id}" title="Remove">🗑</button></td>
      `;
      boqTbody.appendChild(tr);
    });

    boqTbody.querySelectorAll("[data-field='catalogSku']").forEach(el => el.addEventListener("change", handleBoqCatalogSelect));
    boqTbody.querySelectorAll("[data-field]:not([data-field='catalogSku'])").forEach(el => {
      el.addEventListener("input", handleBoqFieldChange);
      el.addEventListener("change", handleBoqFieldChange);
    });
    boqTbody.querySelectorAll("[data-del-boq]").forEach(b =>
      b.addEventListener("click", () => {
        DATA.currentEstimate.boq = DATA.currentEstimate.boq.filter(i => i.id !== b.dataset.delBoq);
        saveDraft();
        renderBoqTable();
        renderCostSummary();
      }));
  }

  function handleBoqCategoryChange(id, newCategory) {
    const item = DATA.currentEstimate.boq.find(i => i.id === id);
    if (!item) return;
    item.category = newCategory;
    item.catalogSku = "";
    item.unit = getUnitsForCategory(newCategory)[0];
    saveDraft();
    renderBoqTable();
    renderCostSummary();
  }

  function handleBoqCatalogSelect(e) {
    const id = e.target.dataset.id;
    const sku = e.target.value;
    const item = DATA.currentEstimate.boq.find(i => i.id === id);
    if (!item) return;

    item.catalogSku = sku;
    if (sku) {
      const catalogItems = getCatalogItemsForCategory(item.category);
      const match = catalogItems.find(ci => ci.sku === sku);
      if (match) {
        item.description = `${match.vendor} ${match.sku} — ${match.description}`;
        item.unitCost = Number(match.unitCost) || 0;
      }
    }
    saveDraft();
    renderBoqTable();
    renderCostSummary();
  }

  function handleBoqFieldChange(e) {
    const id = e.target.dataset.id;
    const field = e.target.dataset.field;

    if (field === "category") {
      handleBoqCategoryChange(id, e.target.value);
      return;
    }

    const item = DATA.currentEstimate.boq.find(i => i.id === id);
    if (!item) return;
    if (field === "qty" || field === "unitCost") {
      item[field] = parseFloat(e.target.value) || 0;
    } else {
      item[field] = e.target.value;
    }
    saveDraft();
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
      <button class="btn btn-primary" id="save-estimate-btn" style="margin-top:10px;">💾 Save Costing Sheet to Database</button>
    `;
    document.getElementById("save-estimate-btn").addEventListener("click", saveCurrentEstimate);
  }

  async function saveCurrentEstimate() {
    syncEstimateFromForm();
    const e = DATA.currentEstimate;
    if (!e.name.trim()) { alert("Please name this costing sheet before saving."); return; }
    e.savedAt = new Date().toISOString();
    if (!e.id) e.id = crypto.randomUUID();

    const clone = JSON.parse(JSON.stringify(e));
    await DB.put("estimates", clone); // Save to IndexedDB
    await refreshData();
    
    renderEstimatesTable();
    renderDashboard();
    alert("Costing sheet saved to database.");
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
          saveDraft();
          renderEstimation();
        }
      }));
      
    estimatesTbody.querySelectorAll("[data-del-est]").forEach(b =>
      b.addEventListener("click", async () => {
        if (confirm("Delete this saved costing sheet?")) {
          await DB.delete("estimates", b.dataset.delEst); // Delete from IndexedDB
          await refreshData();
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
    populateRoleDropdown();
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
          ${["Design Team","Programming Team","Panel Shop","Commissioning Team","Client Team","QA/FAT Team"].map(tm => `<option ${t.team===tm?"selected":""}>${tm}</option>`).join("")}
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
          label: "Save", className: "btn btn-primary", onClick: async () => {
            const title = document.getElementById("k-title").value.trim();
            if (!title) { alert("Task title is required."); return; }
            
            const updated = {
              id: t.id || crypto.randomUUID(),
              title,
              project: document.getElementById("k-project").value.trim(),
              owner: document.getElementById("k-owner").value.trim(),
              team: document.getElementById("k-team").value,
              phase: document.getElementById("k-phase").value,
              notes: document.getElementById("k-notes").value.trim()
            };
            
            await DB.put("kanban", updated); // Save to IndexedDB
            await refreshData();
            closeModal();
            renderKanban();
            flashSyncStatus(true);
          }
        }
      ]
    });
  }

  async function moveTask(taskId, direction) {
    const t = DATA.tasks.find(x => x.id === taskId);
    if (!t) return;
    const idx = PHASES.indexOf(t.phase);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= PHASES.length) return;
    
    t.phase = PHASES[newIdx];
    await DB.put("kanban", t); // Update in IndexedDB
    await refreshData();
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
        card.querySelector("[data-del-task]").addEventListener("click", async () => {
          if (confirm("Delete this task?")) {
            await DB.delete("kanban", t.id); // Delete from IndexedDB
            await refreshData();
            renderKanban();
          }
        });

        cardsWrap.appendChild(card);
      });

      col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
      col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
      col.addEventListener("drop", async (e) => {
        e.preventDefault();
        col.classList.remove("drag-over");
        if (dragTaskId) {
          const t = DATA.tasks.find(x => x.id === dragTaskId);
          if (t) {
            t.phase = phase;
            await DB.put("kanban", t); // Update dropped task in DB
            await refreshData();
            renderKanban();
          }
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
        <p><strong>AGC SCADA Hub</strong> — v1.0 (IndexedDB Engine)</p>
        <p style="margin-top:8px;">Al Gurg Automation and Controls</p>
        <p style="color:var(--slate-400); font-size:0.8rem; margin-top:4px;">
          Al Ittihad Road (Dubai-Sharjah Road), Al Khabisi Area, Deira, PO Box 25490, Dubai, UAE
        </p>
        <p style="margin-top:14px; font-size:0.85rem;">All data is stored locally on this device (IndexedDB) so the app works fully offline on-site. Use <em>Export</em> to back up or transfer your data.</p>
        <button class="btn btn-danger" id="clear-data-btn" style="margin-top:14px;">Clear All Local Database Content</button>
      `,
      footerButtons: [{ label: "Close", className: "btn btn-primary", onClick: closeModal }]
    });
    
    document.getElementById("clear-data-btn").addEventListener("click", async () => {
      if (confirm("This will permanently delete all locally stored database records on this device. Continue?")) {
        // Clear all IndexedDB stores safely
        await Promise.all(DATA.requirements.map(r => DB.delete("requirements", r.id)));
        await Promise.all(DATA.tasks.map(t => DB.delete("kanban", t.id)));
        await Promise.all(DATA.estimates.map(e => DB.delete("estimates", e.id)));
        localStorage.removeItem("agc_draft_estimate");
        
        DATA.currentEstimate = newEstimate();
        await refreshData();
        closeModal();
        renderAll();
      }
    });
  });

  /* =========================================================
     INTEGRATIONS: CSV export, PDF generation, ClickUp/n8n sync
     ========================================================= */
  document.getElementById("export-csv-btn").addEventListener("click", () => {
    syncEstimateFromForm();
    const e = DATA.currentEstimate;
    if (!e.boq.length) { alert("Add at least one BOQ line item before exporting."); return; }
    window.AGC.Export.exportBoqToCsv(e, calcTotals(e));
  });

  document.getElementById("generate-req-pdf-btn").addEventListener("click", () => {
    if (!DATA.requirements.length) { alert("Log at least one requirement before generating the specification PDF."); return; }
    window.AGC.PDF.generateRequirementsPdf(document.getElementById("requirements-table"), { preparedBy: "AGC SCADA Hub" });
  });

  document.getElementById("webhook-settings-btn").addEventListener("click", openWebhookSettingsModal);
  document.getElementById("sync-clickup-btn").addEventListener("click", () => syncBoard("clickup"));
  document.getElementById("sync-n8n-btn").addEventListener("click", () => syncBoard("n8n"));

  function openWebhookSettingsModal() {
    const cfg = window.AGC.Api.getWebhookConfig();
    openModal({
      title: "Webhook Settings",
      bodyHtml: `
        <p style="font-size:0.82rem; color:var(--slate-400); margin-bottom:12px;">
          Paste in your ClickUp automation webhook and/or n8n Webhook node URL. These are stored only on this device.
        </p>
        <label>ClickUp Webhook URL<input type="text" id="w-clickup" value="${escapeAttr(cfg.clickup || "")}"/></label>
        <label>n8n Webhook URL<input type="text" id="w-n8n" value="${escapeAttr(cfg.n8n || "")}"/></label>
      `,
      footerButtons: [
        { label: "Cancel", className: "btn btn-ghost", onClick: closeModal },
        { label: "Save", className: "btn btn-primary", onClick: () => {
            window.AGC.Api.saveWebhookConfig({
              clickup: document.getElementById("w-clickup").value.trim(),
              n8n: document.getElementById("w-n8n").value.trim()
            });
            closeModal();
          }
        }
      ]
    });
  }

  async function syncBoard(target) {
    if (!DATA.tasks.length) { alert("No execution tasks to sync yet."); return; }
    const cfg = window.AGC.Api.getWebhookConfig();
    if (target === "clickup" && !cfg.clickup) { openWebhookSettingsModal(); return; }
    if (target === "n8n" && !cfg.n8n) { openWebhookSettingsModal(); return; }

    const btn = document.getElementById(target === "clickup" ? "sync-clickup-btn" : "sync-n8n-btn");
    const originalLabel = btn.textContent;
    btn.disabled = true; btn.textContent = "Syncing…";

    try {
      if (target === "n8n") {
        const result = await window.AGC.Api.syncFullBoardToN8n(DATA.tasks);
        reportSyncResult(result, `${DATA.tasks.length} task(s) sent to n8n.`);
      } else {
        let successCount = 0;
        for (const task of DATA.tasks) {
          const result = await window.AGC.Api.syncTaskToClickUp(task);
          if (result.ok) successCount++;
        }
        reportSyncResult(
          { ok: successCount === DATA.tasks.length, error: successCount < DATA.tasks.length ? `${DATA.tasks.length - successCount} task(s) failed.` : null },
          `${successCount}/${DATA.tasks.length} task(s) synced to ClickUp.`
        );
      }
    } finally {
      btn.disabled = false; btn.textContent = originalLabel;
    }
  }

  function reportSyncResult(result, successMessage) {
    if (result.ok) alert(`✅ ${successMessage}`);
    else alert(`⚠ Sync did not fully complete: ${result.error || "Unknown error."}\n\nYour board data is safe locally.`);
  }

  /* ---------------- Init Execution ---------------- */
  function renderAll() {
    renderDashboard();
    renderRequirements();
    renderEstimation();
    renderKanban();
  }

  updateOnlineStatus();
  renderAll();
  
  await loadCatalog();
  if (document.getElementById("panel-estimation").classList.contains("active")) {
    renderEstimation();
  } else {
    populateRoleDropdown();
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(e => {}));
  }
});

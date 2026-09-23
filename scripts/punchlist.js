/* =========================================================
   AGC SCADA Hub — punchlist.js
   Cross-functional site snag tracking with WhatsApp integration.
   (Upgraded to IndexedDB)
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("punchlist-container");
  const addBtn = document.getElementById("add-punchlist-btn");
  const modalOverlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalFooter = document.getElementById("modal-footer");
  const modalClose = document.getElementById("modal-close");

  // 1. Fetch initial data from IndexedDB
  let punchlist = await DB.getAll("punchlist");

  // 2. Render function
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

      // Build WhatsApp Deep-Link String
      const waText = encodeURIComponent(
        `⚠️ *Site Snag Alert*\n` +
        `*Project:* Al Gurg SCADA Execution\n` +
        `*Discipline:* ${item.discipline}\n` +
        `*Issue:* ${item.title}\n` +
        `*Notes:* ${item.notes || 'N/A'}\n` +
        `*Status:* ${item.status}`
      );
      const waLink = `https://wa.me/?text=${waText}`;

      // Set badge color based on status
      let badgeClass = "badge-open";
      if (item.status === "In Progress") badgeClass = "badge-progress";
      if (item.status === "Blocked") badgeClass = "badge-blocked";
      if (item.status === "Delivered") badgeClass = "badge-delivered";

      card.innerHTML = `
        <div class="pl-card-top">
          <div>
            <div class="pl-card-title">${item.title}</div>
            <div class="pl-card-meta">Logged: ${item.date} | Tag: ${item.discipline}</div>
          </div>
          <div class="pl-card-badges">
            <span class="badge ${badgeClass}">${item.status}</span>
          </div>
        </div>
        ${item.notes ? `<div class="pl-card-notes">${item.notes}</div>` : ''}
        <div class="pl-card-actions">
          <select class="status-update-select" data-id="${item.id}">
            <option value="Open" ${item.status === 'Open' ? 'selected' : ''}>Open</option>
            <option value="In Progress" ${item.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Blocked" ${item.status === 'Blocked' ? 'selected' : ''}>Blocked</option>
            <option value="Delivered" ${item.status === 'Delivered' ? 'selected' : ''}>Closed / Fixed</option>
          </select>
          <a href="${waLink}" target="_blank" class="btn btn-sm btn-whatsapp" style="text-decoration:none; display:inline-flex;">📱 Share to WA</a>
          <button class="btn btn-sm btn-danger delete-snag-btn" data-id="${item.id}">✕</button>
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
          await DB.put("punchlist", snag); // Update in IndexedDB
          punchlist = await DB.getAll("punchlist"); // Refresh local array
          renderPunchlist(); // Re-render
        }
      });
    });

    // Attach Delete Listeners
    document.querySelectorAll('.delete-snag-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (confirm("Are you sure you want to delete this snag?")) {
          await DB.delete("punchlist", id); // Delete from IndexedDB
          punchlist = await DB.getAll("punchlist"); // Refresh local array
          renderPunchlist(); // Re-render
        }
      });
    });
  }

  // Handle "Log Site Snag" Button Click (Opens Modal)
  if (addBtn) {
    addBtn.addEventListener('click', () => {
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

      // Attach Modal Button Listeners
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
          id: crypto.randomUUID(), // Native browser UUID generation
          title,
          discipline,
          notes,
          status: "Open",
          date: new Date().toISOString().split('T')[0]
        };

        await DB.put("punchlist", newSnag); // Save to IndexedDB
        punchlist = await DB.getAll("punchlist"); // Refresh list
        renderPunchlist(); // Re-render
        
        modalOverlay.classList.add("hidden");
      });
    });
  }

  // Close modal via top-right 'X'
  if (modalClose) {
    modalClose.addEventListener('click', () => {
      modalOverlay.classList.add("hidden");
    });
  }

  // Initialize
  renderPunchlist();
});

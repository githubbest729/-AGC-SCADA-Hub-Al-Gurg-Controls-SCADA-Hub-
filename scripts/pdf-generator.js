/* =========================================================
   AGC SCADA Hub — scripts/pdf-generator.js
   Enterprise Commercial Quotation PDF Generator
   Al Gurg Automation & Controls, Dubai, UAE
   ========================================================= */

window.AGC = window.AGC || {};

window.AGC.PDF = (() => {
  "use strict";

  function generateCostEstimationPdf(estimateData, totals) {
    if (!window.html2pdf) {
      alert("PDF library is loading or unavailable. Please check your internet connection.");
      return;
    }

    const quotationNo = `AGC-QT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const currentDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const currency = estimateData.currency || "AED";

    // Build Material BOQ rows
    const boqRows = (estimateData.boq || []).map((item, index) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${index + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(item.category || "—")}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${item.catalogSku ? `<strong>${escapeHtml(item.catalogSku)}</strong><br>` : ""}${escapeHtml(item.description || "—")}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.qty} ${escapeHtml(item.unit || "pcs")}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${(item.qty * item.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join("") || `<tr><td colspan="6" style="padding: 12px; text-align: center; color: #64748b;">No Bill of Quantities (BOQ) line items added.</td></tr>`;

    // Build Engineering Phases breakdown
    const p = estimateData.phases || {};
    const phasesList = [
      { name: "Design & Architecture", hrs: p.design?.hours || 0, rate: p.design?.rate || 320 },
      { name: "PLC / SCADA Programming", hrs: p.programming?.hours || 0, rate: p.programming?.rate || 280 },
      { name: "FAT Execution", hrs: p.fat?.hours || 0, rate: p.fat?.rate || 260 },
      { name: "SAT & Commissioning", hrs: p.sat?.hours || 0, rate: p.sat?.rate || 300 },
      { name: "Site Supervision", hrs: p.supervision?.hours || 0, rate: p.supervision?.rate || 350 }
    ];

    const engRows = phasesList.map(phase => {
      const lineTotal = phase.hrs * phase.rate;
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${phase.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${phase.hrs} hrs</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${phase.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join("");

    // Create container element for PDF export
    const container = document.createElement("div");
    container.style.padding = "30px";
    container.style.fontFamily = "Arial, sans-serif";
    container.style.color = "#1e293b";
    container.style.background = "#ffffff";
    container.style.fontSize = "10pt";

    container.innerHTML = `
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0; color: #0f172a; font-size: 18pt;">Al Gurg Automation & Controls</h2>
          <p style="margin: 4px 0 0 0; color: #64748b; font-size: 9pt;">
            Al Ittihad Road, Al Khabisi Area, Deira<br>
            PO Box 25490, Dubai, United Arab Emirates
          </p>
        </div>
        <div style="text-align: right;">
          <span style="background: #0f172a; color: white; padding: 4px 10px; font-weight: bold; font-size: 9pt; border-radius: 4px;">COMMERCIAL QUOTATION</span>
          <p style="margin: 8px 0 0 0; font-size: 9pt; color: #475569;"><strong>Date:</strong> ${currentDate}</p>
          <p style="margin: 2px 0 0 0; font-size: 9pt; color: #475569;"><strong>Quotation No:</strong> ${quotationNo}</p>
        </div>
      </div>

      <!-- Project Metadata -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
        <p style="margin: 0 0 4px 0;"><strong>Project Name:</strong> ${escapeHtml(estimateData.name || "Untitled Project")}</p>
        <p style="margin: 0 0 4px 0;"><strong>Client / End User:</strong> ${escapeHtml(estimateData.client || "—")}</p>
        <p style="margin: 0 0 4px 0;"><strong>Currency:</strong> ${currency}</p>
        <p style="margin: 0;"><strong>Validity:</strong> 30 Days from Date of Issue</p>
      </div>

      <!-- Bill of Quantities Table -->
      <h3 style="font-size: 11pt; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px;">1. Bill of Quantities (Hardware &amp; Software Materials)</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9pt;">
        <thead>
          <tr style="background: #f1f5f9; color: #334155; text-align: left;">
            <th style="padding: 8px; width: 30px; text-align: center;">#</th>
            <th style="padding: 8px; width: 90px;">Category</th>
            <th style="padding: 8px;">Description / SKU</th>
            <th style="padding: 8px; width: 70px; text-align: center;">Qty</th>
            <th style="padding: 8px; width: 90px; text-align: right;">Unit (${currency})</th>
            <th style="padding: 8px; width: 100px; text-align: right;">Total (${currency})</th>
          </tr>
        </thead>
        <tbody>
          ${boqRows}
        </tbody>
      </table>

      <!-- Engineering Hours Table -->
      <h3 style="font-size: 11pt; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px;">2. Engineering &amp; Site Services Breakdown</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9pt;">
        <thead>
          <tr style="background: #f1f5f9; color: #334155; text-align: left;">
            <th style="padding: 8px;">Engineering Phase</th>
            <th style="padding: 8px; width: 100px; text-align: center;">Duration</th>
            <th style="padding: 8px; width: 100px; text-align: right;">Rate (${currency}/hr)</th>
            <th style="padding: 8px; width: 110px; text-align: right;">Total (${currency})</th>
          </tr>
        </thead>
        <tbody>
          ${engRows}
        </tbody>
      </table>

      <!-- Summary Section -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
        <div style="width: 320px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; font-size: 9.5pt;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>Materials Subtotal (BOQ):</span>
            <span><strong>${currency} ${totals.boqTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>Engineering Subtotal (${totals.totalHours} hrs):</span>
            <span><strong>${currency} ${totals.engCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; padding-top: 6px; margin-bottom: 6px;">
            <span>Combined Subtotal:</span>
            <span><strong>${currency} ${totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #475569;">
            <span>Contingency (${estimateData.contingency}%):</span>
            <span>${currency} ${totals.contingencyAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #475569;">
            <span>Net Profit Margin (${estimateData.margin}%):</span>
            <span>${currency} ${totals.marginAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 2px solid #0f172a; padding-top: 8px; font-size: 11pt; color: #0f172a;">
            <span><strong>Grand Total:</strong></span>
            <span><strong>${currency} ${totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
          </div>
        </div>
      </div>

      <!-- Footer / Terms -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 12px; display: flex; justify-content: space-between; font-size: 8pt; color: #64748b;">
        <span>Confidential — Al Gurg Automation &amp; Controls</span>
        <span>Page 1 of 1</span>
      </div>
    `;

    // Append temporarily to DOM so html2pdf can read it, then remove it cleanly
    document.body.appendChild(container);

    const opt = {
      margin:       10,
      filename:     `AGC-Quotation-${(estimateData.name || "Project").replace(/\s+/g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(container).set(opt).save().then(() => {
      document.body.removeChild(container);
    }).catch(() => {
      if (document.body.contains(container)) document.body.removeChild(container);
    });
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  return {
    generateCostEstimationPdf,
    generateRequirementsPdf: window.AGC.PDF?.generateRequirementsPdf || (() => {})
  };
})();

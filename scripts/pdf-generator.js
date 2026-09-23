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

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const quotationNo = `AGC-QT-2026-${randomNum}`;
    const filename = `AGC-Quotation-${quotationNo}.pdf`;
    const currentDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const currency = estimateData.currency || "AED";

    // Build Material BOQ rows
    const boqRows = (estimateData.boq || []).map((item, index) => `
      <tr>
        <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: center;">${index + 1}</td>
        <td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(item.category || "—")}</td>
        <td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">${item.catalogSku ? `<strong>${escapeHtml(item.catalogSku)}</strong><br>` : ""}${escapeHtml(item.description || "—")}</td>
        <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.qty} ${escapeHtml(item.unit || "pcs")}</td>
        <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right;">${(item.qty * item.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join("") || `<tr><td colspan="6" style="padding: 10px; text-align: center; color: #64748b;">No Bill of Quantities (BOQ) line items added.</td></tr>`;

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
          <td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">${phase.name}</td>
          <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: center;">${phase.hrs} hrs</td>
          <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right;">${phase.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right;">${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join("");

    // Create container element and explicitly attach to DOM to avoid missing source errors
    const container = document.createElement("div");
    container.id = "agc-pdf-export-container";
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "794px"; // Standard A4 width in px at 96 DPI
    container.style.padding = "30px";
    container.style.fontFamily = "Arial, sans-serif";
    container.style.color = "#1e293b";
    container.style.background = "#ffffff";
    container.style.fontSize = "9.5pt";

    container.innerHTML = `
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px;">
        <div>
          <h2 style="margin: 0; color: #0f172a; font-size: 16pt;">Al Gurg Automation & Controls</h2>
          <p style="margin: 3px 0 0 0; color: #64748b; font-size: 8.5pt;">
            Al Ittihad Road, Al Khabisi Area, Deira<br>
            PO Box 25490, Dubai, United Arab Emirates
          </p>
        </div>
        <div style="text-align: right;">
          <span style="background: #0f172a; color: white; padding: 3px 8px; font-weight: bold; font-size: 8.5pt; border-radius: 3px;">COMMERCIAL QUOTATION</span>
          <p style="margin: 6px 0 0 0; font-size: 8.5pt; color: #475569;"><strong>Date:</strong> ${currentDate}</p>
          <p style="margin: 2px 0 0 0; font-size: 8.5pt; color: #475569;"><strong>Quotation No:</strong> ${quotationNo}</p>
        </div>
      </div>

      <!-- Project Metadata -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 9pt;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td><strong>Project Name:</strong> ${escapeHtml(estimateData.name || "Untitled Project")}</td>
            <td><strong>Currency:</strong> ${currency}</td>
          </tr>
          <tr>
            <td style="padding-top: 4px;"><strong>Client / End User:</strong> ${escapeHtml(estimateData.client || "—")}</td>
            <td style="padding-top: 4px;"><strong>Validity:</strong> 30 Days from Date of Issue</td>
          </tr>
        </table>
      </div>

      <!-- Scope of Work -->
      <h3 style="font-size: 10.5pt; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 6px;">Scope of Work</h3>
      <ul style="margin: 0 0 15px 0; padding-left: 18px; color: #334155; font-size: 8.5pt; line-height: 1.4;">
        <li>Complete hardware engineering, panel fabrication oversight, and PLC/SCADA control philosophy implementation.</li>
        <li>Development of operator HMI graphics, alarm/event logging subsystems, and historian integration.</li>
        <li>Factory Acceptance Testing (FAT) execution at our Dubai facility with client witness testing.</li>
        <li>Site Acceptance Testing (SAT), loop calibration, and seamless plant commissioning.</li>
      </ul>

      <!-- Bill of Quantities Table -->
      <h3 style="font-size: 10.5pt; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 6px;">1. Bill of Quantities (Hardware &amp; Software Materials)</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 8.5pt;">
        <thead>
          <tr style="background: #f1f5f9; color: #334155; text-align: left;">
            <th style="padding: 6px; width: 25px; text-align: center;">#</th>
            <th style="padding: 6px; width: 80px;">Category</th>
            <th style="padding: 6px;">Description / SKU</th>
            <th style="padding: 6px; width: 60px; text-align: center;">Qty</th>
            <th style="padding: 6px; width: 80px; text-align: right;">Unit (${currency})</th>
            <th style="padding: 6px; width: 90px; text-align: right;">Total (${currency})</th>
          </tr>
        </thead>
        <tbody>
          ${boqRows}
        </tbody>
      </table>

      <!-- Engineering Hours Table -->
      <h3 style="font-size: 10.5pt; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 6px;">2. Engineering &amp; Site Services Breakdown</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 8.5pt;">
        <thead>
          <tr style="background: #f1f5f9; color: #334155; text-align: left;">
            <th style="padding: 6px;">Engineering Phase</th>
            <th style="padding: 6px; width: 90px; text-align: center;">Duration</th>
            <th style="padding: 6px; width: 90px; text-align: right;">Rate (${currency}/hr)</th>
            <th style="padding: 6px; width: 100px; text-align: right;">Total (${currency})</th>
          </tr>
        </thead>
        <tbody>
          ${engRows}
        </tbody>
      </table>

      <!-- Summary Section & Payment Terms Layout -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
        <div style="width: 45%; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; font-size: 8pt; color: #334155;">
          <strong>Commercial Payment Terms:</strong><br>
          • 40% Advance upon order placement<br>
          • 40% Upon successful Factory Acceptance Test (FAT)<br>
          • 20% Upon Site Acceptance Test (SAT) &amp; Handover
        </div>
        <div style="width: 48%; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; font-size: 8.5pt;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Materials Subtotal:</span>
            <span><strong>${currency} ${totals.boqTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Engineering Subtotal (${totals.totalHours} hrs):</span>
            <span><strong>${currency} ${totals.engCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; padding-top: 4px; margin-bottom: 4px;">
            <span>Combined Subtotal:</span>
            <span><strong>${currency} ${totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
            <span>Contingency (${estimateData.contingency}%):</span>
            <span>${currency} ${totals.contingencyAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #475569;">
            <span>Net Profit Margin (${estimateData.margin}%):</span>
            <span>${currency} ${totals.marginAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 2px solid #0f172a; padding-top: 6px; font-size: 10.5pt; color: #0f172a;">
            <span><strong>Grand Total:</strong></span>
            <span><strong>${currency} ${totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
          </div>
        </div>
      </div>

      <!-- Signature Block -->
      <div style="display: flex; justify-content: space-between; margin-top: 25px; margin-bottom: 20px; font-size: 8.5pt;">
        <div style="width: 42%; border-top: 1px solid #94a3b8; padding-top: 6px;">
          <strong>Prepared By:</strong><br>
          Al Gurg Automation &amp; Controls<br>
          Estimation &amp; Proposal Engineering Team
        </div>
        <div style="width: 42%; border-top: 1px solid #94a3b8; padding-top: 6px;">
          <strong>Approved &amp; Accepted By (Client):</strong><br>
          Authorized Signature &amp; Company Stamp<br>
          Date: ________________________
        </div>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; display: flex; justify-content: space-between; font-size: 7.5pt; color: #64748b;">
        <span>Confidential — Al Gurg Automation &amp; Controls</span>
        <span>Page 1 of 1</span>
      </div>
    `;

    // Ensure the container is fully mounted in the DOM before html2pdf reads it
    document.body.appendChild(container);

    const opt = {
      margin:       8,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Generate blob and trigger forced download via anchor element
    html2pdf().from(container).set(opt).outputPdf('blob').then((pdfBlob) => {
      const blobUrl = URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = blobUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobUrl);
    }).then(() => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }).catch((err) => {
      console.error("PDF generation failed:", err);
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
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

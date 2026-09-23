/* =========================================================
   AGC SCADA Hub — scripts/pdf-generator.js
   Enterprise Commercial Quotation PDF Generator
   Al Gurg Automation & Controls, Dubai, UAE
   ========================================================= */

window.AGC = window.AGC || {};

window.AGC.PDF = (() => {
  "use strict";

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  // Enterprise/ERP-style currency formatting: ALWAYS exactly 2 decimal
  // places (never 1, never 3). toLocaleString() alone can render 3
  // decimals for values like 29030.485 unless maximumFractionDigits is
  // pinned alongside minimumFractionDigits, so both are set explicitly here.
  function formatCurrency(value) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function generateCostEstimationPdf(estimateData, totals) {
    if (!window.html2pdf) {
      alert("PDF library is still loading. Please wait 2 seconds and try again.");
      return;
    }

    estimateData = estimateData || {};
    totals = totals || {
      boqTotal: 0, engCost: 0, totalHours: 0,
      subtotal: 0, contingencyAmt: 0, marginAmt: 0, grandTotal: 0
    };

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const quotationNo = `AGC-QT-2026-${randomNum}`;
    const filename = `AGC-Quotation-${quotationNo}.pdf`;
    const currentDate = new Date().toLocaleDateString("en-GB", {
      year: "numeric", month: "short", day: "numeric"
    });
    const currency = estimateData.currency || "AED";

    // Build BOQ rows
    const boqRows = (estimateData.boq || []).map((item, index) => {
      const lineTotal = (item.qty || 0) * (item.unitCost || 0);
      const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `
        <tr style="background:${rowBg};">
          <td style="padding:8px 7px;border:1px solid #cbd5e1;text-align:center;color:#64748b;">${index + 1}</td>
          <td style="padding:8px 7px;border:1px solid #cbd5e1;">${escapeHtml(item.category || "—")}</td>
          <td style="padding:8px 7px;border:1px solid #cbd5e1;">
            ${item.catalogSku ? `<strong>${escapeHtml(item.catalogSku)}</strong><br>` : ""}
            ${escapeHtml(item.description || "—")}
          </td>
          <td style="padding:8px 7px;border:1px solid #cbd5e1;text-align:center;">${item.qty || 0} ${escapeHtml(item.unit || "pcs")}</td>
          <td style="padding:8px 7px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(item.unitCost)}</td>
          <td style="padding:8px 7px;border:1px solid #cbd5e1;text-align:right;font-weight:600;">${formatCurrency(lineTotal)}</td>
        </tr>`;
    }).join("") || `
      <tr>
        <td colspan="6" style="padding:12px;border:1px solid #cbd5e1;text-align:center;color:#64748b;">
          No Bill of Quantities (BOQ) line items added.
        </td>
      </tr>`;

    // Engineering rows
    const p = estimateData.phases || {};
    const phasesList = [
      { name: "Design & Architecture",   hrs: p.design?.hours || 0,      rate: p.design?.rate || 320 },
      { name: "PLC / SCADA Programming", hrs: p.programming?.hours || 0, rate: p.programming?.rate || 280 },
      { name: "FAT Execution",           hrs: p.fat?.hours || 0,         rate: p.fat?.rate || 260 },
      { name: "SAT & Commissioning",     hrs: p.sat?.hours || 0,         rate: p.sat?.rate || 300 },
      { name: "Site Supervision",        hrs: p.supervision?.hours || 0, rate: p.supervision?.rate || 350 }
    ];

    const engRows = phasesList.map((phase, index) => {
      const lineTotal = phase.hrs * phase.rate;
      const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `
        <tr style="background:${rowBg};">
          <td style="padding:8px 7px;border:1px solid #cbd5e1;">${phase.name}</td>
          <td style="padding:8px 7px;border:1px solid #cbd5e1;text-align:center;">${phase.hrs} hrs</td>
          <td style="padding:8px 7px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(phase.rate)}</td>
          <td style="padding:8px 7px;border:1px solid #cbd5e1;text-align:right;font-weight:600;">${formatCurrency(lineTotal)}</td>
        </tr>`;
    }).join("");

    // ========== Full HTML as a string ==========
    const htmlContent = `
      <div style="width:740px;padding:20px;font-family:Arial,Helvetica,sans-serif;color:#1e293b;background:#ffffff;font-size:10pt;line-height:1.4;">
        
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:12px;">
          <div>
            <h2 style="margin:0;color:#0f172a;font-size:18pt;">Al Gurg Automation &amp; Controls</h2>
            <p style="margin:4px 0 0;color:#64748b;font-size:9pt;">
              Al Ittihad Road, Al Khabisi Area, Deira<br>
              PO Box 25490, Dubai, United Arab Emirates
            </p>
          </div>
          <div style="text-align:right;">
            <div style="background:#0f172a;color:#fff;padding:5px 12px;font-weight:bold;font-size:9pt;border-radius:4px;display:inline-block;">
              COMMERCIAL QUOTATION
            </div>
            <p style="margin:8px 0 0;font-size:9pt;color:#475569;"><strong>Date:</strong> ${currentDate}</p>
            <p style="margin:2px 0 0;font-size:9pt;color:#475569;"><strong>Quotation No:</strong> ${quotationNo}</p>
          </div>
        </div>

        <!-- Project Info -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 16px;border-radius:6px;margin-bottom:12px;font-size:10pt;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td><strong>Project Name:</strong> ${escapeHtml(estimateData.name || "Untitled Project")}</td>
              <td><strong>Currency:</strong> ${currency}</td>
            </tr>
            <tr>
              <td style="padding-top:6px;"><strong>Client / End User:</strong> ${escapeHtml(estimateData.client || "—")}</td>
              <td style="padding-top:6px;"><strong>Validity:</strong> 30 Days from Date of Issue</td>
            </tr>
          </table>
        </div>

        <!-- Scope of Work -->
        <h3 style="font-size:11pt;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin:0 0 8px;">Scope of Work</h3>
        <ul style="margin:0 0 12px;padding-left:20px;color:#334155;font-size:9.5pt;line-height:1.35;">
          <li>Complete hardware engineering, panel fabrication oversight, and PLC/SCADA control philosophy implementation.</li>
          <li>Development of operator HMI graphics, alarm/event logging subsystems, and historian integration.</li>
          <li>Factory Acceptance Testing (FAT) execution at our Dubai facility with client witness testing.</li>
          <li>Site Acceptance Testing (SAT), loop calibration, and seamless plant commissioning.</li>
        </ul>

        <!-- BOQ -->
        <h3 style="font-size:11pt;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin:0 0 8px;">1. Bill of Quantities (Hardware &amp; Software Materials)</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:9pt;">
          <thead>
            <tr style="background:#0f172a;color:#ffffff;">
              <th style="padding:8px 7px;border:1px solid #0f172a;width:30px;text-align:center;font-weight:600;">#</th>
              <th style="padding:8px 7px;border:1px solid #0f172a;width:90px;font-weight:600;">Category</th>
              <th style="padding:8px 7px;border:1px solid #0f172a;font-weight:600;">Description / SKU</th>
              <th style="padding:8px 7px;border:1px solid #0f172a;width:70px;text-align:center;font-weight:600;">Qty</th>
              <th style="padding:8px 7px;border:1px solid #0f172a;width:90px;text-align:right;font-weight:600;">Unit (${currency})</th>
              <th style="padding:8px 7px;border:1px solid #0f172a;width:100px;text-align:right;font-weight:600;">Total (${currency})</th>
            </tr>
          </thead>
          <tbody>${boqRows}</tbody>
        </table>

        <!-- Engineering -->
        <h3 style="font-size:11pt;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin:0 0 8px;">2. Engineering &amp; Site Services Breakdown</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:9pt;">
          <thead>
            <tr style="background:#0f172a;color:#ffffff;">
              <th style="padding:8px 7px;border:1px solid #0f172a;font-weight:600;">Engineering Phase</th>
              <th style="padding:8px 7px;border:1px solid #0f172a;width:95px;text-align:center;font-weight:600;">Duration</th>
              <th style="padding:8px 7px;border:1px solid #0f172a;width:100px;text-align:right;font-weight:600;">Rate (${currency}/hr)</th>
              <th style="padding:8px 7px;border:1px solid #0f172a;width:105px;text-align:right;font-weight:600;">Total (${currency})</th>
            </tr>
          </thead>
          <tbody>${engRows}</tbody>
        </table>

        <!-- Payment Terms + Totals -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;page-break-inside:avoid;break-inside:avoid;">
          <div style="width:45%;background:#f8fafc;border:1px solid #cbd5e1;padding:12px;border-radius:6px;font-size:9pt;color:#334155;">
            <strong>Commercial Payment Terms:</strong><br><br>
            • 40% Advance upon order placement<br>
            • 40% Upon successful Factory Acceptance Test (FAT)<br>
            • 20% Upon Site Acceptance Test (SAT) &amp; Handover
          </div>
          <div style="width:48%;background:#f8fafc;border:1px solid #cbd5e1;padding:12px;border-radius:6px;font-size:9.5pt;">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
              <span>Materials Subtotal:</span>
              <strong>${currency} ${formatCurrency(totals.boqTotal)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
              <span>Engineering Subtotal (${totals.totalHours || 0} hrs):</span>
              <strong>${currency} ${formatCurrency(totals.engCost)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid #cbd5e1;padding-top:5px;margin-bottom:5px;">
              <span>Combined Subtotal:</span>
              <strong>${currency} ${formatCurrency(totals.subtotal)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:5px;color:#475569;">
              <span>Contingency (${estimateData.contingency || 10}%):</span>
              <span>${currency} ${formatCurrency(totals.contingencyAmt)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;color:#475569;">
              <span>Net Profit Margin (${estimateData.margin || 15}%):</span>
              <span>${currency} ${formatCurrency(totals.marginAmt)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;border-top:2px solid #0f172a;padding-top:8px;font-size:12pt;color:#0f172a;">
              <strong>Grand Total:</strong>
              <strong>${currency} ${formatCurrency(totals.grandTotal)}</strong>
            </div>
          </div>
        </div>

        <!-- Signatures -->
        <div style="display:flex;justify-content:space-between;margin-top:16px;margin-bottom:12px;font-size:9.5pt;page-break-inside:avoid;break-inside:avoid;">
          <div style="width:42%;border-top:1px solid #94a3b8;padding-top:8px;">
            <strong>Prepared By:</strong><br>
            Al Gurg Automation &amp; Controls<br>
            Estimation &amp; Proposal Engineering Team
          </div>
          <div style="width:42%;border-top:1px solid #94a3b8;padding-top:8px;">
            <strong>Approved &amp; Accepted By (Client):</strong><br>
            Authorized Signature &amp; Company Stamp<br>
            Date: ________________________
          </div>
        </div>

        <!-- Footer -->
        <div style="border-top:1px solid #cbd5e1;padding-top:10px;display:flex;justify-content:space-between;font-size:8pt;color:#64748b;page-break-inside:avoid;break-inside:avoid;">
          <span>Confidential — Al Gurg Automation &amp; Controls</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    `;

    // Create a temporary element and put the HTML inside
    const container = document.createElement("div");
    container.innerHTML = htmlContent;
    container.style.position = "fixed";
    container.style.left = "0";
    container.style.top = "0";
    container.style.zIndex = "99999";
    container.style.background = "#ffffff";
    document.body.appendChild(container);

    // Give the browser a moment to render
    setTimeout(() => {
      const element = container.firstElementChild;

      const opt = {
        margin:       8,
        filename:     filename,
        image:        { type: "jpeg", quality: 0.98 },
        html2canvas:  {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff"
        },
        jsPDF:        { unit: "mm", format: "a4", orientation: "portrait" },
        // 'avoid-all' disables html2pdf's risky pixel-row canvas slicing
        // entirely (that's what was cutting the footer text mid-character).
        // 'css' still lets page-break-inside:avoid on the summary/signature/
        // footer blocks above force a clean break to page 2 in the rare case
        // content genuinely doesn't fit — but it will never slice mid-row again.
        pagebreak:    { mode: ["avoid-all", "css"] }
      };

      html2pdf()
        .set(opt)
        .from(element)
        .save()
        .then(() => {
          setTimeout(() => {
            if (document.body.contains(container)) {
              document.body.removeChild(container);
            }
          }, 1500);
        })
        .catch(err => {
          console.error("PDF generation failed:", err);
          alert("Could not generate PDF. Please try again.");
          if (document.body.contains(container)) {
            document.body.removeChild(container);
          }
        });
    }, 300); // small delay so the DOM is painted
  }

  return {
    generateCostEstimationPdf
  };
})();

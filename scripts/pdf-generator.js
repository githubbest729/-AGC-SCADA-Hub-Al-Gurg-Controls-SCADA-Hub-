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

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Ensures the Quotation Number stays the exact same between Preview and Download
  function getDeterministicQuotationNo(id) {
    if (!id) return `AGC-QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0;
    }
    const shortHash = Math.abs(hash).toString().substring(0, 4).padStart(4, '0');
    return `AGC-QT-${new Date().getFullYear()}-${shortHash}`;
  }

  // Generates the raw HTML document for both the Preview Modal and the Final PDF
  function getQuotationHtml(estimateData, totals) {
    const quotationNo = getDeterministicQuotationNo(estimateData.id);
    const revisionNo = estimateData.revision || "00";
    const currentDate = new Date().toLocaleDateString("en-GB", {
      year: "numeric", month: "short", day: "numeric"
    });
    const currency = estimateData.currency || "AED";
    const markup = totals.markupFactor || 1;

    const boqRows = (estimateData.boq || []).map((item, index) => {
      const sellingUnitCost = (item.unitCost || 0) * markup;
      const sellingTotal = (item.qty || 0) * sellingUnitCost;
      const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      
      return `
        <tr style="background:${rowBg}; page-break-inside: avoid; break-inside: avoid;">
          <td style="padding:6px;border:1px solid #cbd5e1;text-align:center;color:#64748b;">${index + 1}</td>
          <td style="padding:6px;border:1px solid #cbd5e1;">
            <strong>${escapeHtml(item.category || "—")}</strong><br>
            <span style="color:#475569; font-size:7.5pt;">${escapeHtml(item.description || "—")}</span>
          </td>
          <td style="padding:6px;border:1px solid #cbd5e1;text-align:center;">${item.qty || 0} ${escapeHtml(item.unit || "pcs")}</td>
          <td style="padding:6px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(sellingUnitCost)}</td>
          <td style="padding:6px;border:1px solid #cbd5e1;text-align:right;font-weight:600;">${formatCurrency(sellingTotal)}</td>
        </tr>`;
    }).join("") || `
      <tr>
        <td colspan="5" style="padding:10px;border:1px solid #cbd5e1;text-align:center;color:#64748b;">
          No Bill of Quantities (BOQ) line items added.
        </td>
      </tr>`;

    const p = estimateData.phases || {};
    const phasesList = [
      { name: "Design & Architecture",   hrs: p.design?.hours || 0,       rate: p.design?.rate || 320 },
      { name: "PLC / SCADA Programming", hrs: p.programming?.hours || 0,  rate: p.programming?.rate || 280 },
      { name: "FAT Execution",           hrs: p.fat?.hours || 0,          rate: p.fat?.rate || 260 },
      { name: "SAT & Commissioning",     hrs: p.sat?.hours || 0,          rate: p.sat?.rate || 300 },
      { name: "Site Supervision",        hrs: p.supervision?.hours || 0,  rate: p.supervision?.rate || 350 }
    ];

    let hasEngineering = false;
    const engRows = phasesList.map((phase, index) => {
      if (phase.hrs === 0) return ""; 
      hasEngineering = true;
      const sellingRate = phase.rate * markup;
      const sellingTotal = phase.hrs * sellingRate;
      const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      
      return `
        <tr style="background:${rowBg}; page-break-inside: avoid; break-inside: avoid;">
          <td style="padding:6px;border:1px solid #cbd5e1;">${phase.name}</td>
          <td style="padding:6px;border:1px solid #cbd5e1;text-align:center;">${phase.hrs} hrs</td>
          <td style="padding:6px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(sellingRate)}</td>
          <td style="padding:6px;border:1px solid #cbd5e1;text-align:right;font-weight:600;">${formatCurrency(sellingTotal)}</td>
        </tr>`;
    }).join("");

    const finalEngRows = hasEngineering ? engRows : `<tr><td colspan="4" style="padding:10px;border:1px solid #cbd5e1;text-align:center;color:#64748b;">No engineering services included.</td></tr>`;

    return `
      <div style="width:720px;padding:15px;font-family:Arial,Helvetica,sans-serif;color:#1e293b;background:#ffffff;font-size:9pt;line-height:1.3;">
        
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:6px;margin-bottom:8px;">
          <div>
            <h2 style="margin:0;color:#0f172a;font-size:15pt;text-transform:uppercase;letter-spacing:0.5px;">Al Gurg Automation &amp; Controls</h2>
            <p style="margin:2px 0 0;color:#64748b;font-size:8pt;">
              Easa Saleh Al Gurg Group | Jebel Ali Industrial Area<br>
              PO Box 325, Dubai, United Arab Emirates | <strong>TRN:</strong> 100345678900003
            </p>
          </div>
          <div style="text-align:right;">
            <div style="background:#0f172a;color:#fff;padding:4px 10px;font-weight:bold;font-size:8pt;border-radius:4px;display:inline-block;">
              COMMERCIAL QUOTATION
            </div>
            <p style="margin:4px 0 0;font-size:8pt;color:#475569;"><strong>Date:</strong> ${currentDate} | <strong>Rev:</strong> ${revisionNo}</p>
            <p style="margin:2px 0 0;font-size:8pt;color:#475569;"><strong>Quotation No:</strong> ${quotationNo}</p>
          </div>
        </div>

        <!-- Project Info -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px 12px;border-radius:4px;margin-bottom:8px;font-size:9pt;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td><strong>Project Name:</strong> ${escapeHtml(estimateData.name || "Untitled Project")}</td>
              <td><strong>Currency:</strong> ${currency}</td>
            </tr>
            <tr>
              <td style="padding-top:4px;"><strong>Client / End User:</strong> ${escapeHtml(estimateData.client || "—")}</td>
              <td style="padding-top:4px;"><strong>Validity:</strong> 30 Days from Issue</td>
            </tr>
          </table>
        </div>

        <!-- Scope of Work -->
        <h3 style="font-size:10pt;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:2px;margin:0 0 4px;">Scope of Work</h3>
        <ul style="margin:0 0 8px;padding-left:15px;color:#334155;font-size:8.5pt;line-height:1.3;">
          <li>Complete hardware provision and PLC/SCADA control philosophy implementation.</li>
          <li>Development of operator HMI graphics, alarm/event logging subsystems, and historian integration.</li>
          <li>Factory Acceptance Testing (FAT) execution at AGC Dubai facility and Site Acceptance Testing (SAT).</li>
        </ul>

        <!-- BOQ -->
        <h3 style="font-size:10pt;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:2px;margin:0 0 4px;">1. Bill of Quantities (Hardware &amp; Software)</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:8.5pt;">
          <thead>
            <tr style="background:#0f172a;color:#ffffff;">
              <th style="padding:5px 6px;border:1px solid #0f172a;width:25px;text-align:center;">#</th>
              <th style="padding:5px 6px;border:1px solid #0f172a;">Category & Description</th>
              <th style="padding:5px 6px;border:1px solid #0f172a;width:60px;text-align:center;">Qty</th>
              <th style="padding:5px 6px;border:1px solid #0f172a;width:85px;text-align:right;">Unit (${currency})</th>
              <th style="padding:5px 6px;border:1px solid #0f172a;width:95px;text-align:right;">Total (${currency})</th>
            </tr>
          </thead>
          <tbody>${boqRows}</tbody>
        </table>

        <!-- Engineering -->
        <h3 style="font-size:10pt;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:2px;margin:0 0 4px;">2. Engineering &amp; Site Services Breakdown</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:8.5pt;">
          <thead>
            <tr style="background:#0f172a;color:#ffffff;">
              <th style="padding:5px 6px;border:1px solid #0f172a;">Engineering Phase</th>
              <th style="padding:5px 6px;border:1px solid #0f172a;width:80px;text-align:center;">Duration</th>
              <th style="padding:5px 6px;border:1px solid #0f172a;width:85px;text-align:right;">Rate (${currency}/hr)</th>
              <th style="padding:5px 6px;border:1px solid #0f172a;width:95px;text-align:right;">Total (${currency})</th>
            </tr>
          </thead>
          <tbody>${finalEngRows}</tbody>
        </table>

        <!-- Payment Terms + Totals -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:10px;margin-bottom:10px;page-break-inside:avoid;break-inside:avoid;">
          
          <div style="width:50%;font-size:8pt;color:#334155;padding-right:10px;">
            <div style="font-weight:700;color:#0f172a;margin-bottom:4px;">Commercial Terms &amp; Conditions:</div>
            <ul style="margin:0;padding-left:12px;line-height:1.3;">
              <li style="margin-bottom: 2px;"><strong>Payment:</strong> 40% Advance (against ABG), 40% upon FAT, 20% upon SAT.</li>
              <li style="margin-bottom: 2px;"><strong>Delivery:</strong> 8-10 weeks (EXW Jebel Ali Facility).</li>
              <li style="margin-bottom: 2px;"><strong>Warranty:</strong> 12 months from commissioning.</li>
              <li style="margin-bottom: 2px;"><strong>Bank:</strong> Emirates NBD, Acct: 1012345678901</li>
            </ul>
          </div>
          
          <div style="width:45%;background:#f8fafc;border:1px solid #cbd5e1;padding:8px;border-radius:4px;font-size:8.5pt;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span>Materials Subtotal:</span>
              <strong>${currency} ${formatCurrency(totals.sellingBoqTotal)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span>Engineering Subtotal:</span>
              <strong>${currency} ${formatCurrency(totals.sellingEngCost)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid #cbd5e1;padding-top:3px;margin-bottom:3px;">
              <span style="font-weight:600;">Total (Excl. VAT):</span>
              <span style="font-weight:600;">${currency} ${formatCurrency(totals.sellingSubtotal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;color:#475569;">
              <span>VAT (5%):</span>
              <span>${currency} ${formatCurrency(totals.vatAmount)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;border-top:2px solid #0f172a;padding-top:5px;font-size:10.5pt;color:#0f172a;">
              <strong>Grand Total:</strong>
              <strong>${currency} ${formatCurrency(totals.grandTotal)}</strong>
            </div>
          </div>
        </div>

        <!-- Signatures -->
        <div style="display:flex;justify-content:space-between;margin-top:15px;margin-bottom:8px;font-size:8.5pt;page-break-inside:avoid;break-inside:avoid;">
          <div style="width:45%;border-top:1px solid #94a3b8;padding-top:6px;color:#475569;line-height:1.3;">
            <strong>Prepared By:</strong><br>
            <span style="color:#0f172a;font-weight:600;">Christian Tosita Espinosa</span><br>
            I&amp;C Engineer | Al Gurg Automation &amp; Controls
          </div>
          <div style="width:45%;border-top:1px solid #94a3b8;padding-top:6px;color:#475569;">
            <strong>Approved By (Client):</strong><br>
            Authorized Signature &amp; Stamp<br>
            Date: ________________________
          </div>
        </div>

        <!-- Footer -->
        <div style="border-top:1px solid #cbd5e1;padding-top:6px;display:flex;justify-content:space-between;font-size:7.5pt;color:#64748b;page-break-inside:avoid;break-inside:avoid;">
          <span>Confidential — Al Gurg Automation &amp; Controls</span>
          <span>Generated via AGC SCADA Hub</span>
        </div>
      </div>
    `;
  }

  function generateCostEstimationPdf(estimateData, totals) {
    const htmlContent = getQuotationHtml(estimateData, totals);
    const quotationNo = getDeterministicQuotationNo(estimateData.id);
    const revisionNo = estimateData.revision || "00";
    const filename = `AGC-Quotation-${quotationNo}-Rev${revisionNo}.pdf`;

    const container = document.createElement("div");
    container.innerHTML = htmlContent;
    
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.visibility = "hidden";
    container.style.background = "#ffffff";
    document.body.appendChild(container);

    requestAnimationFrame(() => {
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
        pagebreak:    { mode: ["avoid-all", "css"] }
      };

      html2pdf()
        .set(opt)
        .from(element)
        .save()
        .catch(err => {
          console.error("PDF generation failed:", err);
          alert("Could not generate PDF. Please try again.");
        })
        .finally(() => {
          if (container && document.body.contains(container)) {
            container.remove();
          }
        });
    });
  }

  function generateRequirementsPdf(tableElement, options = {}) {
    if (!window.html2pdf) {
      alert("PDF library is still loading. Please wait.");
      return;
    }
    if (!tableElement) return;

    const container = document.createElement("div");
    container.style.fontFamily = "Arial, Helvetica, sans-serif";
    container.style.color = "#0f172a";
    container.style.padding = "20px";
    container.style.background = "#fff";
    container.style.width = "1050px"; 

    const header = document.createElement("div");
    header.innerHTML = `
      <h2 style="color: #0f172a; margin-top: 0;">Project Requirements Specification</h2>
      <p style="color: #475569; font-size: 10pt; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px;">
        Generated: ${new Date().toLocaleString()}<br>
        Prepared By: ${escapeHtml(options.preparedBy || "Christian Tosita Espinosa | AGC SCADA Hub")}
      </p>
    `;
    container.appendChild(header);

    const tableClone = tableElement.cloneNode(true);
    tableClone.style.width = "100%";
    tableClone.style.borderCollapse = "collapse";
    tableClone.style.fontSize = "9pt";

    tableClone.querySelectorAll("th").forEach(th => {
      th.style.backgroundColor = "#0f172a";
      th.style.color = "#ffffff";
      th.style.padding = "8px";
      th.style.border = "1px solid #0f172a";
      th.style.textAlign = "left";
    });

    tableClone.querySelectorAll("td").forEach(td => {
      td.style.padding = "8px";
      td.style.border = "1px solid #cbd5e1";
    });

    tableClone.querySelectorAll("tr").forEach(tr => {
      tr.style.pageBreakInside = "avoid";
      tr.style.breakInside = "avoid";
      if (tr.lastElementChild) tr.removeChild(tr.lastElementChild);
    });

    container.appendChild(tableClone);
    
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.visibility = "hidden";
    document.body.appendChild(container);

    const opt = {
      margin:       8,
      filename:     `AGC-Requirements-${new Date().toISOString().slice(0, 10)}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak:    { mode: ["avoid-all", "css"] }
    };

    requestAnimationFrame(() => {
      html2pdf()
        .set(opt)
        .from(container)
        .save()
        .catch(err => {
          console.error("Requirements PDF generation failed:", err);
          alert("Could not generate Requirements PDF.");
        })
        .finally(() => {
          if (container && document.body.contains(container)) {
            container.remove();
          }
        });
    });
  }

  return {
    getQuotationHtml,
    generateCostEstimationPdf,
    generateRequirementsPdf
  };
})();

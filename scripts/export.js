/* =========================================================
   AGC SCADA Hub — scripts/export.js
   Enterprise Client-Side CSV Export Engine
   Aligns with the Multi-Phase Costing and Markup Factor logic.
   Provides a clear breakdown of Raw Costs vs. Selling Prices
   for the internal estimation team.
   ========================================================= */

(function (global) {
  "use strict";

  const AGC = global.AGC = global.AGC || {};

  /**
   * Escape a single CSV field: wrap in quotes if it contains a
   * comma, quote, or newline, and double up any internal quotes.
   */
  function csvField(value) {
    const str = String(value ?? "");
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function csvRow(fields) {
    return fields.map(csvField).join(",") + "\r\n";
  }

  /**
   * Build a CSV string from an estimate object.
   */
  function buildCostingCsv(estimate, totals) {
    let csv = "";
    
    // Fetch the hidden markup multiplier calculated in app.js
    const markup = totals.markupFactor || 1;

    // --- Header / Meta Block ---
    csv += csvRow(["AGC SCADA Hub - Enterprise Costing Sheet Export"]);
    csv += csvRow(["Project Name", estimate.name || "Untitled"]);
    csv += csvRow(["Client", estimate.client || ""]);
    csv += csvRow(["Currency", estimate.currency || "AED"]);
    csv += csvRow(["Generated", new Date().toLocaleString()]);
    csv += csvRow([]); // blank line

    // --- BOQ Line Items (Internal vs External Split) ---
    csv += csvRow(["1. BILL OF QUANTITIES"]);
    csv += csvRow(["Category", "SKU", "Description", "Qty", "Unit", "Raw Unit Cost", "Raw Total", "Selling Unit Cost", "Selling Total"]);
    
    (estimate.boq || []).forEach((item) => {
      const rawUnit = Number(item.unitCost) || 0;
      const qty = Number(item.qty) || 0;
      const rawTotal = qty * rawUnit;
      
      const sellingUnit = rawUnit * markup;
      const sellingTotal = rawTotal * markup;

      csv += csvRow([
        item.category || "",
        item.catalogSku || "",
        item.description || "",
        qty,
        item.unit || "",
        rawUnit.toFixed(2),
        rawTotal.toFixed(2),
        sellingUnit.toFixed(2),
        sellingTotal.toFixed(2)
      ]);
    });

    csv += csvRow([]); // blank line

    // --- Engineering Hours (Multi-Phase Split) ---
    csv += csvRow(["2. ENGINEERING & SITE SERVICES"]);
    csv += csvRow(["Engineering Phase", "Hours", "Raw Rate/Hr", "Raw Total", "Selling Rate/Hr", "Selling Total"]);
    
    const p = estimate.phases || {};
    const phasesList = [
      { name: "Design & Architecture",   hrs: p.design?.hours || 0,       rate: p.design?.rate || 320 },
      { name: "PLC / SCADA Programming", hrs: p.programming?.hours || 0,  rate: p.programming?.rate || 280 },
      { name: "FAT Execution",           hrs: p.fat?.hours || 0,          rate: p.fat?.rate || 260 },
      { name: "SAT & Commissioning",     hrs: p.sat?.hours || 0,          rate: p.sat?.rate || 300 },
      { name: "Site Supervision",        hrs: p.supervision?.hours || 0,  rate: p.supervision?.rate || 350 }
    ];

    phasesList.forEach(phase => {
      if (phase.hrs > 0) {
        const rawTotal = phase.hrs * phase.rate;
        const sellingRate = phase.rate * markup;
        const sellingTotal = rawTotal * markup;
        
        csv += csvRow([
          phase.name,
          phase.hrs,
          phase.rate.toFixed(2),
          rawTotal.toFixed(2),
          sellingRate.toFixed(2),
          sellingTotal.toFixed(2)
        ]);
      }
    });

    csv += csvRow([]); // blank line

    // --- Commercial Summary ---
    csv += csvRow(["3. COMMERCIAL SUMMARY", ""]);
    csv += csvRow(["Raw Materials Cost (BOQ)", (totals.rawBoqTotal || 0).toFixed(2)]);
    csv += csvRow(["Raw Engineering Cost", (totals.rawEngCost || 0).toFixed(2)]);
    csv += csvRow(["Internal Base Cost", (totals.rawSubtotal || 0).toFixed(2)]);
    csv += csvRow([`Contingency (${estimate.contingency || 0}%)`, (totals.contingencyAmt || 0).toFixed(2)]);
    csv += csvRow([`Net Profit Margin (${estimate.margin || 0}%)`, (totals.marginAmt || 0).toFixed(2)]);
    csv += csvRow([]); // blank spacer
    csv += csvRow(["Client Selling Subtotal (Excl. VAT)", (totals.sellingSubtotal || 0).toFixed(2)]);
    csv += csvRow(["VAT (5%)", (totals.vatAmount || 0).toFixed(2)]);
    csv += csvRow(["GRAND TOTAL (Incl. VAT)", (totals.grandTotal || 0).toFixed(2)]);

    return csv;
  }

  /**
   * Trigger a native browser download of the given text content.
   */
  function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke slightly after click to satisfy some mobile browsers
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Public entry point: builds and downloads the CSV for a costing sheet.
   * @param {Object} estimate - the current/loaded estimate object
   * @param {Object} totals   - calcTotals(estimate) result from app.js
   */
  function exportBoqToCsv(estimate, totals) {
    if (!estimate || !Array.isArray(estimate.boq)) {
      console.warn("AGC.Export: no valid estimate provided.");
      return;
    }
    const csv = buildCostingCsv(estimate, totals);
    const safeName = (estimate.name || "costing-sheet")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    
    // ISO Timestamp for version control (e.g. 2026-09-23T14-30-00)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `AGC-Internal-Costing-${safeName || "untitled"}-${timestamp}.csv`;
    
    // Prepend UTF-8 BOM so Excel renders special characters correctly
    downloadTextFile(filename, "\uFEFF" + csv, "text/csv;charset=utf-8;");
  }

  AGC.Export = {
    exportBoqToCsv,
    buildCostingCsv,
    downloadTextFile
  };
})(window);

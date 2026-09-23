/* =========================================================
   AGC SCADA Hub — scripts/export.js
   Client-side CSV export for the Cost Estimation BOQ.
   No backend required — builds a CSV Blob in-browser and
   triggers a native download so it can be emailed straight
   to the estimation team.
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
   * estimate: { name, client, currency, rate, contingency, margin, engHours, boq: [...] }
   * totals: result of calcTotals(estimate) — { boqTotal, engCost, subtotal, contingencyAmt, marginAmt, grandTotal }
   */
  function buildCostingCsv(estimate, totals) {
    let csv = "";

    // Header / meta block
    csv += csvRow(["AGC SCADA Hub - Costing Sheet Export"]);
    csv += csvRow(["Costing Sheet Name", estimate.name || "Untitled"]);
    csv += csvRow(["Client", estimate.client || ""]);
    csv += csvRow(["Currency", estimate.currency || "AED"]);
    csv += csvRow(["Generated", new Date().toLocaleString()]);
    csv += csvRow([]); // blank line

    // BOQ line items
    csv += csvRow(["Category", "Description", "Qty", "Unit", "Unit Cost", "Line Total"]);
    (estimate.boq || []).forEach((item) => {
      const lineTotal = (Number(item.qty) || 0) * (Number(item.unitCost) || 0);
      csv += csvRow([
        item.category || "",
        item.description || "",
        item.qty ?? 0,
        item.unit || "",
        (Number(item.unitCost) || 0).toFixed(2),
        lineTotal.toFixed(2)
      ]);
    });

    csv += csvRow([]); // blank line

    // Engineering hours
    csv += csvRow(["Engineering Hours", estimate.engHours ?? 0, "Rate", (Number(estimate.rate) || 0).toFixed(2),
      "Engineering Cost", (totals.engCost || 0).toFixed(2)]);

    csv += csvRow([]); // blank line

    // Totals summary
    csv += csvRow(["Summary", ""]);
    csv += csvRow(["BOQ Materials Subtotal", (totals.boqTotal || 0).toFixed(2)]);
    csv += csvRow(["Engineering Cost", (totals.engCost || 0).toFixed(2)]);
    csv += csvRow(["Subtotal", (totals.subtotal || 0).toFixed(2)]);
    csv += csvRow([`Contingency (${estimate.contingency || 0}%)`, (totals.contingencyAmt || 0).toFixed(2)]);
    csv += csvRow([`Margin (${estimate.margin || 0}%)`, (totals.marginAmt || 0).toFixed(2)]);
    csv += csvRow(["GRAND TOTAL", (totals.grandTotal || 0).toFixed(2)]);

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
    const filename = `agc-boq-${safeName || "untitled"}-${new Date().toISOString().slice(0, 10)}.csv`;
    // Prepend UTF-8 BOM so Excel renders special characters correctly
    downloadTextFile(filename, "\uFEFF" + csv, "text/csv;charset=utf-8;");
  }

  AGC.Export = {
    exportBoqToCsv,
    buildCostingCsv,
    downloadTextFile
  };
})(window);

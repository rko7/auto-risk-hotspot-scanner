console.log("client js loaded");

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("searchForm");
  const results = document.getElementById("results");
  const resultsToolbar = document.getElementById("resultsToolbar");
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const searchBtn = document.getElementById("searchBtn");
  const resetBtn = document.getElementById("resetBtn");
  const dataNote = document.getElementById("dataNote");
  const toastHost = document.getElementById("toastHost");

  let lastItems = [];
  let lastQueryMeta = null;

  // toast state
  let toastTimer = null;
  let activeToastEl = null;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatValue(v) {
    // ArcGIS date fields are often milliseconds since epoch
    if (typeof v === "number" && v > 1000000000000) {
      const d = new Date(v);
      return d.toISOString().slice(0, 10);
    }
    if (v === null || v === undefined) return "";
    return String(v);
  }

  function getField(attrs, candidates) {
    for (let i = 0; i < candidates.length; i++) {
      const k = candidates[i];
      if (attrs && Object.prototype.hasOwnProperty.call(attrs, k)) {
        return attrs[k];
      }
    }
    return "";
  }

  function setLoadingState(isLoading) {
    if (!searchBtn) return;
    searchBtn.disabled = !!isLoading;
    searchBtn.textContent = isLoading ? "Loading..." : "Search";
  }

  function showInitialHint() {
    results.innerHTML = "<p>Select a <strong>Date Range</strong> and <strong>Police Division</strong>, then click <strong>Search</strong>.</p>";
  }

  function clearToast() {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    if (activeToastEl && activeToastEl.parentNode) {
      activeToastEl.parentNode.removeChild(activeToastEl);
    }
    activeToastEl = null;
  }

  function showToast(type, title, message, autoMs) {
    if (!toastHost) return;

    // single active toast only
    clearToast();

    const safeType = type || "info";
    const ms = typeof autoMs === "number" ? autoMs : (safeType === "error" ? 6500 : 4200);

    const wrap = document.createElement("div");
    wrap.className = "toast toast-" + safeType;
    wrap.setAttribute("role", safeType === "error" ? "alert" : "status");
    wrap.innerHTML =
      "<div class='toast-left'></div>" +
      "<div class='toast-body'>" +
        "<p class='toast-title'>" + escapeHtml(title || "Notice") + "</p>" +
        "<p class='toast-msg'>" + escapeHtml(message || "") + "</p>" +
      "</div>" +
      "<button class='toast-close' type='button' aria-label='Close'>&times;</button>";

    const closeBtn = wrap.querySelector(".toast-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        clearToast();
      });
    }

    toastHost.appendChild(wrap);
    activeToastEl = wrap;

    toastTimer = setTimeout(function () {
      clearToast();
    }, ms);
  }

  function topCounts(items, fieldCandidates) {
    const counts = {};
    for (let i = 0; i < items.length; i++) {
      const attrs = items[i] && items[i].attributes ? items[i].attributes : {};
      const v = getField(attrs, fieldCandidates);

      // treat empty string as missing too
      const vv = (v === null || v === undefined) ? "" : String(v).trim();
      const key = vv ? vv : "(missing)";

      counts[key] = (counts[key] || 0) + 1;
    }

    const pairs = Object.keys(counts).map(function (k) {
      return { key: k, count: counts[k] };
    });

    pairs.sort(function (a, b) {
      return b.count - a.count;
    });

    return pairs.slice(0, 3);
  }

  function buildSearchSummary(meta, count) {
    let html = "";
    html += "<div class='search-summary-box'>";
    html += "<p class='search-summary-line'>";
    html += "<span class='search-summary-label'>Search Summary:</span> ";
    html += "Showing <span class='search-summary-value'>" + escapeHtml(count) + "</span> result(s) ";
    html += "(limit <span class='search-summary-value'>" + escapeHtml(meta.limit) + "</span>) ";
    html += "for <span class='search-summary-value'>Division " + escapeHtml(meta.division) + "</span> ";
    if (meta.severity) {
      html += "with <span class='search-summary-value'>Severity " + escapeHtml(meta.severity) + "</span> ";
    }
    html += "from <span class='search-summary-value'>" + escapeHtml(meta.dateFrom) + "</span> ";
    html += "to <span class='search-summary-value'>" + escapeHtml(meta.dateTo) + "</span>.";
    html += "</p>";
    html += "</div>";
    return html;
  }

  function renderBarChart(title, pairs, totalCount) {
    if (!pairs || !pairs.length || !totalCount) return "";

    let html = "";
    html += "<div class='summary-chart'>";
    html += "<p class='chart-title'>" + escapeHtml(title) + "</p>";

    for (let i = 0; i < pairs.length; i++) {
      const item = pairs[i];
      const pct = Math.round((item.count / totalCount) * 100);

      html += "<div class='chart-row'>";
      html += "<div class='chart-row-head'>";
      html += "<span class='chart-label'>" + escapeHtml(item.key) + "</span>";
      html += "<span class='chart-value'>" + item.count + " (" + pct + "%)</span>";
      html += "</div>";
      html += "<div class='chart-track'>";
      html += "<div class='chart-fill' style='width: " + pct + "%'></div>";
      html += "</div>";
      html += "</div>";
    }

    html += "</div>";
    return html;
  }

  function renderSummary(items, meta) {
    const topDivisions = topCounts(items, ["DIVISION"]);
    const topSeverity = topCounts(items, ["INJURY", "ACCLASS"]);

    let html = "";

    if (meta) {
      html += buildSearchSummary(meta, items.length);
    }

    html += "<p><strong>Items:</strong> " + items.length + "</p>";

    html += "<p><strong>Top Divisions:</strong></p>";
    html += "<ul>";
    for (let i = 0; i < topDivisions.length; i++) {
      html += "<li><strong>" + escapeHtml(topDivisions[i].key) + "</strong>: " + topDivisions[i].count + "</li>";
    }
    html += "</ul>";

    html += "<p><strong>Top Severity:</strong></p>";
    html += "<ul>";
    for (let i = 0; i < topSeverity.length; i++) {
      html += "<li><strong>" + escapeHtml(topSeverity[i].key) + "</strong>: " + topSeverity[i].count + "</li>";
    }
    html += "</ul>";

    // add small visual chart for professional display
    html += renderBarChart("Severity Distribution", topSeverity, items.length);

    return html;
  }

  function getRowView(attrs) {
    const dateVal = getField(attrs, ["DATE"]);
    const districtVal = getField(attrs, ["DISTRICT"]);
    const divisionVal = getField(attrs, ["DIVISION"]);

    let loc = getField(attrs, ["LOCATION", "INTERSECTION"]);

    if (!loc) {
      const s1 = getField(attrs, ["STREET1"]);
      const s2 = getField(attrs, ["STREET2"]);
      if (s1 && s2) loc = s1 + " / " + s2;
      else loc = s1 || s2 || "";
    }

    const sev = getField(attrs, ["INJURY", "ACCLASS"]);

    return {
      date: formatValue(dateVal),
      district: districtVal ? String(districtVal) : "(missing)",
      division: divisionVal ? String(divisionVal) : "(missing)",
      location: formatValue(loc),
      severity: formatValue(sev)
    };
  }

  function renderTable(items) {
    let html = "";
    html += "<table border='1' cellpadding='6' cellspacing='0'>";
    html += "<tr>";
    html += "<th>Date</th>";
    html += "<th>District</th>";
    html += "<th>Division</th>";
    html += "<th>Location</th>";
    html += "<th>Severity</th>";
    html += "</tr>";

    for (let i = 0; i < items.length; i++) {
      const attrs = items[i] && items[i].attributes ? items[i].attributes : {};
      const row = getRowView(attrs);

      html += "<tr>";
      html += "<td>" + escapeHtml(row.date) + "</td>";
      html += "<td>" + escapeHtml(row.district) + "</td>";
      html += "<td>" + escapeHtml(row.division) + "</td>";
      html += "<td>" + escapeHtml(row.location) + "</td>";
      html += "<td>" + escapeHtml(row.severity) + "</td>";
      html += "</tr>";
    }

    html += "</table>";
    return html;
  }

  function csvEscape(value) {
    const s = String(value === null || value === undefined ? "" : value);
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function buildCsv(items) {
    const lines = [];
    lines.push(["Date", "District", "Division", "Location", "Severity"].join(","));

    for (let i = 0; i < items.length; i++) {
      const attrs = items[i] && items[i].attributes ? items[i].attributes : {};
      const row = getRowView(attrs);

      lines.push([
        csvEscape(row.date),
        csvEscape(row.district),
        csvEscape(row.division),
        csvEscape(row.location),
        csvEscape(row.severity)
      ].join(","));
    }

    return lines.join("\n");
  }

  function downloadCsv(filename, csvText) {
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  function makeCsvFileName() {
    const from = lastQueryMeta && lastQueryMeta.dateFrom ? lastQueryMeta.dateFrom : "from";
    const to = lastQueryMeta && lastQueryMeta.dateTo ? lastQueryMeta.dateTo : "to";
    const div = lastQueryMeta && lastQueryMeta.division ? lastQueryMeta.division : "all";
    const sev = lastQueryMeta && lastQueryMeta.severity ? ("_" + String(lastQueryMeta.severity).replace(/\s+/g, "-")) : "";
    return "toronto_hotspots_div" + div + sev + "_" + from + "_to_" + to + ".csv";
  }

  function appendDatasetRangeToNote(minISO, maxISO) {
    if (!dataNote) return;
    if (!minISO || !maxISO) return;

    // avoid duplicate line if this runs again
    if (dataNote.querySelector(".range-line")) return;

    const span = document.createElement("span");
    span.className = "range-line";
    span.innerHTML =
      "<br><br>&nbsp;&nbsp;Available dataset date range: " +
      "<span class='range-date'>" + escapeHtml(minISO) + "</span> to " +
      "<span class='range-date'>" + escapeHtml(maxISO) + "</span>.";

    dataNote.appendChild(span);
  }

  async function loadDatasetDateRange() {
    try {
      const resp = await fetch("/api/debug/minmax");
      if (!resp.ok) return;

      const data = await resp.json();
      if (!data || !data.ok) return;

      const minISO = data.minISO || "";
      const maxISO = data.maxISO || "";

      appendDatasetRangeToNote(minISO, maxISO);

      const dateFromInput = document.getElementById("dateFrom");
      const dateToInput = document.getElementById("dateTo");

      if (minISO && maxISO && dateFromInput && dateToInput) {
        dateFromInput.min = minISO;
        dateFromInput.max = maxISO;
        dateToInput.min = minISO;
        dateToInput.max = maxISO;

        // default to latest available range (last 30 days ending at dataset max date)
        const maxMs = Date.parse(maxISO + "T00:00:00Z");
        const minMs = Date.parse(minISO + "T00:00:00Z");

        if (!Number.isNaN(maxMs) && !Number.isNaN(minMs)) {
          const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
          let defaultFromMs = maxMs - thirtyDaysMs;
          if (defaultFromMs < minMs) defaultFromMs = minMs;

          const defaultFromISO = new Date(defaultFromMs).toISOString().slice(0, 10);

          if (!dateFromInput.value) dateFromInput.value = defaultFromISO;
          if (!dateToInput.value) dateToInput.value = maxISO;
        } else {
          // fallback if date parsing fails
          if (!dateFromInput.value) dateFromInput.value = minISO;
          if (!dateToInput.value) dateToInput.value = maxISO;
        }
      }
    } catch (err) {
      console.log(err);
    }
  }

  function clearResultsState() {
    lastItems = [];
    lastQueryMeta = null;
    if (resultsToolbar) resultsToolbar.hidden = true;
    setLoadingState(false);
    showInitialHint();
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", function () {
      if (!lastItems || !lastItems.length) {
        showToast("warn", "Nothing to export", "Run a search first to export results to CSV.");
        return;
      }

      const csvText = buildCsv(lastItems);
      downloadCsv(makeCsvFileName(), csvText);
      showToast("success", "CSV exported", "Your results were downloaded successfully.");
    });
  }

  // keep results view consistent when the form is reset
  form.addEventListener("reset", function () {
    clearToast();
    clearResultsState();

    // allow native reset first, then re-apply dataset defaults
    setTimeout(function () {
      loadDatasetDateRange();
    }, 0);

    showToast("info", "Form reset", "Inputs and results were cleared.");
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      if (resultsToolbar) resultsToolbar.hidden = true;
    });
  }

  showInitialHint();
  loadDatasetDateRange();

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const dateFrom = document.getElementById("dateFrom").value;
    const dateTo = document.getElementById("dateTo").value;
    const division = document.getElementById("division").value;
    const severity = document.getElementById("severity").value;
    const limit = Number(document.getElementById("limit").value || 25);

    // simple client checks
    if (!dateFrom || !dateTo || !division) {
      results.innerHTML = "<p>Missing required input.</p>";
      if (resultsToolbar) resultsToolbar.hidden = true;
      showToast("error", "Missing required input", "Please select a date range and a police division before searching.");
      return;
    }
    if (dateFrom > dateTo) {
      results.innerHTML = "<p>Date range is invalid.</p>";
      if (resultsToolbar) resultsToolbar.hidden = true;
      showToast("error", "Invalid date range", "From date must be on or before To date.");
      return;
    }

    const payload = {
      dateFrom: dateFrom,
      dateTo: dateTo,
      division: division,
      severity: severity,
      limit: limit
    };

    console.log("sending:");
    console.log(payload);

    results.innerHTML = "<p>Loading...</p>";
    lastItems = [];
    lastQueryMeta = null;
    if (resultsToolbar) resultsToolbar.hidden = true;
    clearToast();
    setLoadingState(true);
    showToast("info", "Searching", "Fetching results from the TPS dataset...", 2200);

    try {
      const resp = await fetch("/api/hotspots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(function () { return ""; });
        results.innerHTML = "<p>Server error.</p><pre>" + escapeHtml(txt) + "</pre>";
        if (resultsToolbar) resultsToolbar.hidden = true;
        showToast("error", "Server error", "The server could not load results. Please try again.");
        return;
      }

      const data = await resp.json();

      console.log("received:");
      console.log(data);

      const items = data.items || [];

      lastItems = items.slice();
      lastQueryMeta = {
        dateFrom: dateFrom,
        dateTo: dateTo,
        division: division,
        severity: severity,
        limit: limit
      };

      if (!items.length) {
        let noResultsHtml = "";
        noResultsHtml += "<div class='search-summary-box'>";
        noResultsHtml += "<p class='search-summary-line'>";
        noResultsHtml += "<span class='search-summary-label'>Search Summary:</span> ";
        noResultsHtml += "No results found for ";
        noResultsHtml += "<span class='search-summary-value'>Division " + escapeHtml(division) + "</span>";
        if (severity) {
          noResultsHtml += " with <span class='search-summary-value'>Severity " + escapeHtml(severity) + "</span>";
        }
        noResultsHtml += " from <span class='search-summary-value'>" + escapeHtml(dateFrom) + "</span> ";
        noResultsHtml += "to <span class='search-summary-value'>" + escapeHtml(dateTo) + "</span>.";
        noResultsHtml += "</p>";
        noResultsHtml += "</div>";
        results.innerHTML = noResultsHtml;
        if (resultsToolbar) resultsToolbar.hidden = true;

        showToast("warn", "No results", "Try a wider date range, a different division, or another severity.");
        return;
      }

      let html = "";
      html += renderSummary(items, lastQueryMeta);
      html += renderTable(items);
      results.innerHTML = html;

      if (resultsToolbar) resultsToolbar.hidden = false;

      showToast("success", "Results loaded", "Successfully loaded " + items.length + " record(s).");
    } catch (err) {
      console.log(err);
      results.innerHTML = "<p>Request failed.</p>";
      if (resultsToolbar) resultsToolbar.hidden = true;
      showToast("error", "Request failed", "Network error or server not reachable. Please try again.");
    } finally {
      setLoadingState(false);
    }
  });
});
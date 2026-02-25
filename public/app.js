console.log("client js loaded");

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("searchForm");
  const results = document.getElementById("results");
  const dataNote = document.getElementById("dataNote");

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

  function renderSummary(items) {
    const topDivisions = topCounts(items, ["DIVISION"]);
    const topSeverity = topCounts(items, ["INJURY", "ACCLASS"]);

    let html = "";
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

    return html;
  }

  function renderSearchContext(payload, returnedCount) {
    let html = "";
    html += "<div class='search-summary-box'>";
    html += "<p class='search-summary-line'>";
    html += "<strong class='search-summary-label'>Search Summary:</strong> ";
    html += "Showing <strong class='search-summary-value'>" + escapeHtml(String(returnedCount)) + "</strong> result(s) ";
    html += "(limit <strong class='search-summary-value'>" + escapeHtml(String(payload.limit)) + "</strong>) ";
    html += "for <strong class='search-summary-value'>Division " + escapeHtml(String(payload.division)) + "</strong> ";
    html += "from <strong class='search-summary-value'>" + escapeHtml(payload.dateFrom) + "</strong> ";
    html += "to <strong class='search-summary-value'>" + escapeHtml(payload.dateTo) + "</strong>";

    if (payload.severity) {
      html += " with <strong class='search-summary-value'>Severity " + escapeHtml(payload.severity) + "</strong>";
    }

    html += ".";
    html += "</p>";
    html += "</div>";
    return html;
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

      html += "<tr>";
      html += "<td>" + escapeHtml(formatValue(dateVal)) + "</td>";
      html += "<td>" + escapeHtml(districtVal ? String(districtVal) : "(missing)") + "</td>";
      html += "<td>" + escapeHtml(divisionVal ? String(divisionVal) : "(missing)") + "</td>";
      html += "<td>" + escapeHtml(formatValue(loc)) + "</td>";
      html += "<td>" + escapeHtml(formatValue(sev)) + "</td>";
      html += "</tr>";
    }

    html += "</table>";
    return html;
  }

  function setInitialMessage() {
    results.innerHTML =
      "<p>Select a <strong>Date Range</strong> and <strong>Police Division</strong>, then click <strong>Search</strong>.</p>";
  }

  async function loadDateBounds() {
    try {
      const resp = await fetch("/api/debug/minmax");
      if (!resp.ok) return;

      const data = await resp.json();
      if (!data || !data.ok) return;

      const minISO = data.minISO;
      const maxISO = data.maxISO;

      if (!minISO || !maxISO) return;

      const dateFromInput = document.getElementById("dateFrom");
      const dateToInput = document.getElementById("dateTo");

      // limit selectable dates to available dataset range
      dateFromInput.min = minISO;
      dateFromInput.max = maxISO;
      dateToInput.min = minISO;
      dateToInput.max = maxISO;

      // append dynamic date range note once
      if (dataNote && !dataNote.dataset.rangeLoaded) {
        dataNote.innerHTML +=
          "<span class='range-line'>Available dataset date range: " +
          "<span class='range-date'>" + escapeHtml(minISO) + "</span> to " +
          "<span class='range-date'>" + escapeHtml(maxISO) + "</span>.</span>";
        dataNote.dataset.rangeLoaded = "1";
      }
    } catch (err) {
      console.log(err);
    }
  }

  setInitialMessage();
  loadDateBounds();

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const dateFrom = document.getElementById("dateFrom").value;
    const dateTo = document.getElementById("dateTo").value;
    const division = document.getElementById("division").value;
    const severity = document.getElementById("severity").value;
    const limit = Number(document.getElementById("limit").value || 25);

    // simple client checks
    if (!dateFrom || !dateTo || !division) {
      results.innerHTML = "<p>Please fill in all required fields.</p>";
      return;
    }
    if (dateFrom > dateTo) {
      results.innerHTML = "<p>From date must be on or before To date.</p>";
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

    results.innerHTML = "<p>Loading results...</p>";

    try {
      const resp = await fetch("/api/hotspots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(function () { return ""; });
        results.innerHTML = "<p>Server error while loading results.</p><pre>" + escapeHtml(txt) + "</pre>";
        return;
      }

      const data = await resp.json();

      console.log("received:");
      console.log(data);

      const items = data.items || [];
      if (!items.length) {
        results.innerHTML =
          "<p>No results found for the selected filters. Try a wider date range, another division, or a different severity.</p>";
        return;
      }

      let html = "";
      html += renderSearchContext(payload, items.length);
      html += renderSummary(items);
      html += renderTable(items);
      results.innerHTML = html;
    } catch (err) {
      console.log(err);
      results.innerHTML = "<p>Request failed. Please try again.</p>";
    }
  });
});
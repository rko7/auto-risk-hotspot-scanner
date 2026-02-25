console.log("client js loaded");

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("searchForm");
  const results = document.getElementById("results");
  const dateFromInput = document.getElementById("dateFrom");
  const dateToInput = document.getElementById("dateTo");
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
      html += "<li>" + escapeHtml(topDivisions[i].key) + ": " + topDivisions[i].count + "</li>";
    }
    html += "</ul>";

    html += "<p><strong>Top Severity:</strong></p>";
    html += "<ul>";
    for (let i = 0; i < topSeverity.length; i++) {
      html += "<li>" + escapeHtml(topSeverity[i].key) + ": " + topSeverity[i].count + "</li>";
    }
    html += "</ul>";

    return html;
  }

  function applyDateBounds(minISO, maxISO) {
    if (!minISO || !maxISO) return;

    // set dataset-wide valid range on both date inputs
    dateFromInput.min = minISO;
    dateFromInput.max = maxISO;
    dateToInput.min = minISO;
    dateToInput.max = maxISO;
  }

  function syncDateRangeBounds() {
    // keep from/to inputs mutually valid after user changes one side
    if (dateFromInput.value) {
      dateToInput.min = dateFromInput.value;
    } else if (dateFromInput.min) {
      dateToInput.min = dateFromInput.min;
    }

    if (dateToInput.value) {
      dateFromInput.max = dateToInput.value;
    } else if (dateToInput.max) {
      dateFromInput.max = dateToInput.max;
    }
  }

  async function loadDatasetDateBounds() {
    try {
      const resp = await fetch("/api/debug/minmax");
      if (!resp.ok) return;

      const data = await resp.json();
      if (!data || !data.ok) return;

      const minISO = data.minISO;
      const maxISO = data.maxISO;

      applyDateBounds(minISO, maxISO);
      syncDateRangeBounds();

      // append available range once to avoid duplicate note text
      if (dataNote && minISO && maxISO && !dataNote.dataset.rangeLoaded) {
        dataNote.innerHTML += "<br><span class='range-line'>Available dataset date range: " +
        "<span class='range-date'>" + escapeHtml(minISO) + "</span> to " +
        "<span class='range-date'>" + escapeHtml(maxISO) + "</span>.</span>";
        dataNote.dataset.rangeLoaded = "1";
      }
    } catch (err) {
      console.log(err);
      // fail silently so the app still works even if min/max lookup fails
    }
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

  // update date picker limits as the user changes either side
  dateFromInput.addEventListener("change", syncDateRangeBounds);
  dateToInput.addEventListener("change", syncDateRangeBounds);

  // load dataset min/max dates and apply input bounds on page load
  loadDatasetDateBounds();

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const dateFrom = document.getElementById("dateFrom").value;
    const dateTo = document.getElementById("dateTo").value;
    const division = document.getElementById("division").value;
    const limit = Number(document.getElementById("limit").value || 25);

    // simple client checks
    if (!dateFrom || !dateTo || !division) {
      results.innerHTML = "<p>missing input</p>";
      return;
    }
    if (dateFrom > dateTo) {
      results.innerHTML = "<p>date range is invalid</p>";
      return;
    }

    const payload = {
      dateFrom: dateFrom,
      dateTo: dateTo,
      division: division,
      limit: limit
    };

    console.log("sending:");
    console.log(payload);

    results.innerHTML = "<p>loading...</p>";

    try {
      const resp = await fetch("/api/hotspots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(function () { return ""; });
        results.innerHTML = "<p>server error</p><pre>" + escapeHtml(txt) + "</pre>";
        return;
      }

      const data = await resp.json();

      console.log("received:");
      console.log(data);

      const items = data.items || [];
      if (!items.length) {
        results.innerHTML = "<p>no results</p>";
        return;
      }

      let html = "";
      html += renderSummary(items);
      html += renderTable(items);
      results.innerHTML = html;
    } catch (err) {
      console.log(err);
      results.innerHTML = "<p>request failed</p>";
    }
  });
});
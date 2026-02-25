const express = require("express");

const app = express();
const PORT = 3000;

// TPS KSI FeatureServer query endpoint
const KSI_QUERY_URL =
  "https://services.arcgis.com/S9th0jAJ7bqgIRjw/arcgis/rest/services/TOTAL_KSI/FeatureServer/0/query";

// serve static files
app.use("/app", express.static(__dirname + "/public"));

// parse JSON body
app.use(express.json());

function clamp(n, min, max) {
  n = Number(n);
  if (Number.isNaN(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function cleanText(s) {
  return String(s || "").replace(/'/g, "").trim();
}


// basic yyyy-mm-dd validation (avoid weird inputs)
function isYmd(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// yyyy-mm-dd + 1 day => yyyy-mm-dd (used for exclusive end date)
function addOneDayDateStr(dateStr) {
  const ms = Date.parse(dateStr + "T00:00:00Z");
  if (Number.isNaN(ms)) return null;
  const next = new Date(ms + 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

// build DATE where using ArcGIS DATE literal
function buildDateWhere(dateFrom, dateTo) {
  if (!isYmd(dateFrom) || !isYmd(dateTo)) return null;

  const toExclusive = addOneDayDateStr(dateTo);
  if (!toExclusive) return null;

  // IMPORTANT: ArcGIS Date field filter should use DATE literals
  return `DATE >= DATE '${dateFrom}' AND DATE < DATE '${toExclusive}'`;
}

// build division where (accept "51" and "D51")
function buildDivisionWhere(division) {
  const cleanDivNum = String(division || "").trim().toUpperCase().replace("D", "");
  if (!cleanDivNum) return null;
  const targetDiv = "D" + cleanDivNum;

  // NOTE: based on /api/debug/sample, DIVISION looks like "D55" (string)
  // so accept both "55" and "D55"
  return `(DIVISION = '${targetDiv}' OR DIVISION = '${cleanDivNum}')`;
}

// build optional severity where (supports INJURY / ACCLASS)
function buildSeverityWhere(severity) {
  const s = String(severity || "").trim();
  if (!s) return null;

  // basic escaping for single quotes
  const escaped = s.replace(/'/g, "''");

  return `(INJURY = '${escaped}' OR ACCLASS = '${escaped}')`;
}

// only print fields once
let printedFields = false;

app.post("/api/hotspots", async function (req, res) {
  console.log("body:");
  console.log(req.body);

  // read inputs from client
  const dateFrom = cleanText(req.body.dateFrom);
  const dateTo = cleanText(req.body.dateTo);
  const division = cleanText(req.body.division); // code like "51"
  const severity = cleanText(req.body.severity); // optional
  const limit = clamp(req.body.limit || 25, 1, 100);

  // basic input check
  if (!dateFrom || !dateTo || !division) {
    return res.status(400).json({ ok: false });
  }

  const dateWhere = buildDateWhere(dateFrom, dateTo);
  if (!dateWhere) {
    return res.status(400).json({ ok: false, message: "invalid date format (use yyyy-mm-dd)" });
  }

  const divisionWhere = buildDivisionWhere(division);
  if (!divisionWhere) {
    return res.status(400).json({ ok: false, message: "invalid division" });
  }

  // build ArcGIS SQL where condition
  let where = `${dateWhere} AND ${divisionWhere}`;

  const severityWhere = buildSeverityWhere(severity);
  if (severityWhere) {
    where = `${where} AND ${severityWhere}`;
  }

  const params = new URLSearchParams({
    where: where,
    outFields: "*",
    orderByFields: "DATE DESC",
    resultRecordCount: String(limit),
    returnGeometry: "false",
    f: "json"
  });

  try {
    const url = KSI_QUERY_URL + "?" + params.toString();
    console.log("tps url:");
    console.log(url);

    const resp = await fetch(url);
    const data = await resp.json();

    // if TPS fails
    if (!resp.ok) {
      return res.status(502).json({ ok: false, message: "upstream error", raw: data });
    }

    if (!printedFields && data.features && data.features.length > 0) {
      printedFields = true;
      console.log("fields:");
      console.log(Object.keys(data.features[0].attributes || {}));
    }

    res.json({
      ok: true,
      items: data.features || []
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ ok: false });
  }
});

// ===== DEV DEBUG ROUTES =====
app.get("/api/debug/sample", async function (req, res) {
  try {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      resultRecordCount: "1",
      returnGeometry: "false",
      f: "json"
    });

    const url = KSI_QUERY_URL + "?" + params.toString();
    console.log("debug sample url:");
    console.log(url);

    const resp = await fetch(url);
    const data = await resp.json();

    const first = data.features && data.features[0] ? data.features[0].attributes : null;

    res.json({
      ok: true,
      keys: first ? Object.keys(first) : [],
      sample: first
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ ok: false });
  }
});

// min/max DATE across entire dataset
app.get("/api/debug/minmax", async function (req, res) {
  try {
    const params = new URLSearchParams({
      where: "1=1",
      outStatistics: JSON.stringify([
        { statisticType: "min", onStatisticField: "DATE", outStatisticFieldName: "minDate" },
        { statisticType: "max", onStatisticField: "DATE", outStatisticFieldName: "maxDate" }
      ]),
      f: "json"
    });

    const url = KSI_QUERY_URL + "?" + params.toString();
    console.log("debug minmax url:");
    console.log(url);

    const resp = await fetch(url);
    const data = await resp.json();

    const attrs = data.features && data.features[0] ? data.features[0].attributes : null;
    const minDate = attrs ? attrs.minDate : null;
    const maxDate = attrs ? attrs.maxDate : null;

    function toIso(ms) {
      if (typeof ms !== "number") return null;
      const d = new Date(ms);
      return d.toISOString().slice(0, 10);
    }

    res.json({
      ok: true,
      raw: { minDate, maxDate },
      minISO: toIso(minDate),
      maxISO: toIso(maxDate)
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ ok: false });
  }
});

// Count rows for a date range, optionally with div
// /api/debug/counts?from=2021-01-01&to=2021-12-31
// /api/debug/counts?from=2021-01-01&to=2021-12-31&div=51
app.get("/api/debug/counts", async function (req, res) {
  try {
    const from = cleanText(req.query.from);
    const to = cleanText(req.query.to);
    const div = cleanText(req.query.div);

    if (!from || !to) {
      return res.status(400).json({ ok: false, message: "missing query params: from,to" });
    }

    const dateWhere = buildDateWhere(from, to);
    if (!dateWhere) {
      return res.status(400).json({ ok: false, message: "invalid date format (use yyyy-mm-dd)" });
    }

    let where = dateWhere;

    if (div) {
      const divWhere = buildDivisionWhere(div);
      if (!divWhere) return res.status(400).json({ ok: false, message: "invalid div" });
      where = `${where} AND ${divWhere}`;
    }

    const params = new URLSearchParams({
      where,
      outFields: "OBJECTID",
      returnCountOnly: "true",
      f: "json"
    });

    const url = KSI_QUERY_URL + "?" + params.toString();
    console.log("debug counts url:");
    console.log(url);

    const resp = await fetch(url);
    const data = await resp.json();

    res.json({ ok: true, where, count: data.count ?? null, raw: data });
  } catch (err) {
    console.log(err);
    res.status(500).json({ ok: false });
  }
});

// division counts within date range
// /api/debug/division-counts?from=2021-01-01&to=2021-12-31
app.get("/api/debug/division-counts", async function (req, res) {
  try {
    const from = cleanText(req.query.from);
    const to = cleanText(req.query.to);

    if (!from || !to) {
      return res.status(400).json({ ok: false, message: "missing query params: from,to" });
    }

    const dateWhere = buildDateWhere(from, to);
    if (!dateWhere) {
      return res.status(400).json({ ok: false, message: "invalid date format (use yyyy-mm-dd)" });
    }

    // group by DIVISION
    const params = new URLSearchParams({
      where: dateWhere,
      outFields: "DIVISION",
      groupByFieldsForStatistics: "DIVISION",
      outStatistics: JSON.stringify([
        { statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "cnt" }
      ]),
      orderByFields: "cnt DESC",
      returnGeometry: "false",
      f: "json"
    });

    const url = KSI_QUERY_URL + "?" + params.toString();
    console.log("debug division-counts url:");
    console.log(url);

    const resp = await fetch(url);
    const data = await resp.json();

    res.json({ ok: true, where: dateWhere, rows: data.features || [], raw: data });
  } catch (err) {
    console.log(err);
    res.status(500).json({ ok: false });
  }
});
// ========================

app.listen(PORT, function () {
  console.log("server listening on port 3000...");
});
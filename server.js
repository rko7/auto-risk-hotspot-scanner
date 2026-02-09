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

app.post("/api/hotspots", async function (req, res) {
    console.log("body:");
    console.log(req.body);
    
    // read inputs from client
    const dateFrom = req.body.dateFrom;
    const dateTo = req.body.dateTo;
    const area = req.body.area;
    const limit = Number(req.body.limit || 25);
    
    // basic input check
    if (!dateFrom || !dateTo || !area) {
        return res.status(400).json({ ok: false });
    }
    
    // build ArcGIS SQL where condition
    const where =
    "DATE >= DATE '" + dateFrom + "'" +
    " AND DATE <= DATE '" + dateTo + "'" +
    " AND DISTRICT LIKE '%" + area + "%'";
    
    // build query parameters
    const params = new URLSearchParams({
        where: where,
        outFields: "*",
        resultRecordCount: String(limit),
        returnGeometry: "false",
        f: "json"
    });
    
    try {
        // call TPS external API
        const url = KSI_QUERY_URL + "?" + params.toString();
        console.log("tps url:");
        console.log(url);

    const resp = await fetch(url);
    const data = await resp.json();

    // send results back to client
    res.json({
      ok: true,
      items: data.features || []
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ ok: false });
  }
});

app.listen(PORT, function () {
    console.log("server listening on port 3000...");
});

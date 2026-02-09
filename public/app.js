console.log("client js loaded");

document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("searchForm");
    const results = document.getElementById("results");

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

    function pickColumns(attrs) {
        // Try common field names first (safe guesses)
        const preferred = [
            "DATE",
            "OCC_DATE",
            "ACC_DATE",
            "EVENT_DATE",
            "D_DATE",
            "REPORT_DATE",
            "DISTRICT",
            "DIVISION",
            "NEIGHBOURHOOD",
            "WARD",
            "INTERSECTION",
            "LOCATION",
            "STREET1",
            "STREET2",
            "INJURY",
            "INJURY_SEVERITY",
            "KSI",
            "FATAL",
            "SERIOUS",
            "MODE",
            "CLASSIFICATION"
        ];

        const keys = Object.keys(attrs || {});
        const cols = [];

        for (let i = 0; i < preferred.length; i++) {
            const k = preferred[i];
            if (keys.indexOf(k) !== -1) cols.push(k);
            if (cols.length >= 5) break;
        }

        // Fallback: just show first 5 keys so it never breaks
        if (cols.length === 0) {
            for (let j = 0; j < keys.length && j < 5; j++) {
                cols.push(keys[j]);
            }
        }

        return cols;
    }
  
    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const dateFrom = document.getElementById("dateFrom").value;
        const dateTo = document.getElementById("dateTo").value;
        const area = document.getElementById("area").value;
        const limit = Number(document.getElementById("limit").value || 25);

        // simple client checks
        if (!dateFrom || !dateTo || !area) {
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
            area: area,
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
                results.innerHTML = "<p>server error</p>";
                return;}
        
            const data = await resp.json();

            console.log("received:");
            console.log(data);
            
            const items = data.items || [];
            if (!items.length) {
                results.innerHTML = "<p>no results</p>";
                return;
            }
            
            const first = items[0];
            const attrs = first && first.attributes ? first.attributes : {};
            const columns = pickColumns(attrs);

            let html = "";
            html += "<p>items: " + items.length + "</p>";
            html += "<table border='1' cellpadding='6' cellspacing='0'>";
            html += "<tr>";

            for (let c = 0; c < columns.length; c++) {
                html += "<th>" + escapeHtml(columns[c]) + "</th>";
            }
            
            html += "</tr>";
            
            for (let i = 0; i < items.length; i++) {
                const a = items[i] && items[i].attributes ? items[i].attributes : {};
                html += "<tr>";
                
                for (let c2 = 0; c2 < columns.length; c2++) {
                    const key = columns[c2];
                    html += "<td>" + escapeHtml(formatValue(a[key])) + "</td>";
                }

                html += "</tr>";
            }
            html += "</table>";
            results.innerHTML = html;
        } catch (err) {
            console.log(err);
            results.innerHTML = "<p>request failed</p>";
        }
    });
});

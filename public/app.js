console.log("client js loaded");

document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("searchForm");
    const results = document.getElementById("results");

    function escapeHtml(s) {
        return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&lt;")
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
            const key = v ? String(v) : "unknown";
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
        const topDistricts = topCounts(items, ["DISTRICT", "DIVISION", "NEIGHBOURHOOD", "WARD"]);
        let html = "";
        html += "<p>items: " + items.length + "</p>";
        html += "<p>top districts:</p>";
        html += "<ul>";
        for (let i = 0; i < topDistricts.length; i++) {
            html += "<li>" + escapeHtml(topDistricts[i].key) + ": " + topDistricts[i].count + "</li>";
            }
        html += "</ul>";
    
        return html;
    }
    
    function renderTable(items) {
        let html = "";
        html += "<table border='1' cellpadding='6' cellspacing='0'>";
        html += "<tr>";
        html += "<th>Date</th>";
        html += "<th>District</th>";
        html += "<th>Location</th>";
        html += "<th>Severity</th>";
        html += "</tr>";
    
        for (let i = 0; i < items.length; i++) {
            const attrs = items[i] && items[i].attributes ? items[i].attributes : {};
            const dateVal = getField(attrs, ["DATE", "OCC_DATE", "ACC_DATE", "EVENT_DATE", "REPORT_DATE"]);
            const districtVal = getField(attrs, ["DISTRICT", "DIVISION", "NEIGHBOURHOOD", "WARD"]);
      
            let loc = getField(attrs, ["LOCATION", "INTERSECTION"]);
      
            if (!loc) {
                const s1 = getField(attrs, ["STREET1"]);
                const s2 = getField(attrs, ["STREET2"]);
                if (s1 && s2) loc = s1 + " / " + s2;
                else loc = s1 || s2 || "";
            }
      
            const sev = getField(attrs, ["INJURY_SEVERITY", "INJURY", "KSI", "FATAL", "SERIOUS", "CLASSIFICATION"]);
      
            html += "<tr>";
            html += "<td>" + escapeHtml(formatValue(dateVal)) + "</td>";
            html += "<td>" + escapeHtml(formatValue(districtVal)) + "</td>";
            html += "<td>" + escapeHtml(formatValue(loc)) + "</td>";
            html += "<td>" + escapeHtml(formatValue(sev)) + "</td>";
            html += "</tr>";
        }
        html += "</table>";
        return html;
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

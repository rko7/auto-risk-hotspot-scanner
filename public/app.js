console.log("client js loaded");

document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("searchForm");
    const results = document.getElementById("results");
  
    form.addEventListener("submit", async function (e) {
        e.preventDefault();
    
        const payload = {
            dateFrom: document.getElementById("dateFrom").value,
            dateTo: document.getElementById("dateTo").value,
            area: document.getElementById("area").value,
            limit: Number(document.getElementById("limit").value || 25)
        };
        
        console.log("sending:");
        console.log(payload);
    
        try {
            const resp = await fetch("/api/hotspots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        
            const data = await resp.json();

            console.log("received:");
            console.log(data);
        
            results.innerHTML = "<pre>" + JSON.stringify(data, null, 2) + "</pre>";
        } catch (err) {
            console.log(err);
            results.innerHTML = "<p>request failed</p>";
        }
    });
});

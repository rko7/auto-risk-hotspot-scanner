const express = require("express");

const app = express();
const PORT = 3000;

// serve static files
app.use("/app", express.static(__dirname + "/public"));

// parse JSON body
app.use(express.json());

app.post("/api/hotspots", function (req, res) {
    console.log("body:");
    console.log(req.body);
  
    res.json({
        ok: true,
        received: req.body,
        items: []
    });
});

app.listen(PORT, function () {
    console.log("server listening on port 3000...");
});

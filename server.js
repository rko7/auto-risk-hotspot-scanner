const express = require("express");

const app = express();
const PORT = 3000;

// serve static files
app.use("/app", express.static(__dirname + "/public"));

app.listen(PORT, function () {
    console.log("server listening on port 3000...");
});

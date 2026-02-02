const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.get("/app", function (req, res) {
  res.send("Server is running. Next: serve index.html");
});

app.listen(PORT, function () {
  console.log("server listening on port 3000...");
});

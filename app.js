// app.js
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res
    .status(200)
    .send("<h1>Welcome to the CI/CD Workshop!</h1>");
});


app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

module.exports = app;

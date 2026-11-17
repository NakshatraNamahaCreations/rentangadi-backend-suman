const express = require("express");
const router = express.Router();
const dashboard = require("../controller/dashboard");

/* One call for the whole first screen. See controller/dashboard.js. */
router.get("/summary", dashboard.summary);

module.exports = router;

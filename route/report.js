const express = require("express");
const reportController = require("../controller/report");


const router = express.Router();

router.get("/productsReport", reportController.productReport);
router.get("/orderReport", reportController.orderReport);
router.post("/productReportByMonth", reportController.productReportByMonth);
router.get("/product-report-by-dates", reportController.productReportDates);
router.post("/clientReportByMonth", reportController.clientReportByMonth);

module.exports = router;

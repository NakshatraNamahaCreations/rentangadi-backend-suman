const express = require("express");
const router = express.Router();
const paymentController = require("../controller/CCAvenue"); // Corrected path

router.post("/paymentccavenue", paymentController.initiatePayment);
router.post("/responsepayment", paymentController.paymentResponse);

module.exports = router;

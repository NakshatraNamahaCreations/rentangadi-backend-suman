const express = require("express");
const router = express.Router();
const PaymentController = require("../controller/payu");

router.post("/hash", PaymentController.initiatePayment);
router.post("/success/:txnid", PaymentController.verifyPayment);

module.exports = router;

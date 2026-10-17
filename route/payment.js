const express = require("express");
const router = express.Router();
const { createPayment, getAllPayments, getPaymentById, deletePayment } = require("../controller/payment");

// POST API to create a payment
router.post("/", createPayment);
router.get("/", getAllPayments);
router.get("/:id", getPaymentById);
router.delete("/:id", deletePayment);

module.exports = router;

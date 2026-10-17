const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    quotationId: {
      type: String,
      ref: "Quotation",
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    advancedAmount: {
      type: Number,
      required: true,
    },
    paymentMode: {
      type: String,
      enum: ["Offline", "Online"],
      required: true,
    },
    paymentRemarks: {
      type: String,
    },
    comment: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Pending", "Completed"],

    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);

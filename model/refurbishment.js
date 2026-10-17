const mongoose = require("mongoose");

const RefurbishmentSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      require: true,
    },
    productSKU: {
      type: String,
    },
    comment: {
      type: String,
    },
    expense: {
      type: Number,
    },
    date: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const Refurbishmentmodel = mongoose.model("Refurbishment", RefurbishmentSchema);
module.exports = Refurbishmentmodel;

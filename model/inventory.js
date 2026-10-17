const mongoose = require("mongoose");

const InventorySchema = new mongoose.Schema({
  productId: {
    type: String,
    ref: "Product",
    required: true,
  },
  startdate: {
    type: String,
    required: true,
  },
  enddate: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
  },
  // slot: {
  //   type: String,
  //   required: true,
  // },
  reservedQty: {
    type: Number,
    default: 0,
  },
  availableQty: {
    type: Number,
    required: true,
  },
});


/* The availability lookups filter on productId + slot and then a date
   window; without this the collection is scanned every time. */
InventorySchema.index({ productId: 1, slot: 1, startdate: 1, enddate: 1 });

const Inventory = mongoose.model("Inventory", InventorySchema);
module.exports = Inventory;

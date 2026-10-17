const mongoose = require("mongoose");



const RefurbishmentSchemaData = new mongoose.Schema({
  products: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, required: true },
      productName: { type: String, required: true },
      quantity: { type: Number, required: true },
      damage: { type: String, default: "" },
      price: { type: Number, required: true },
    }
  ],
  orderId: { type: String, required: true },
  // shippingAddress: { type: String, required: true },
  // floorManager: { type: String, required: true },
  status: { type: String, required: true },
}, { timestamps: true });

const RefurbishmentData = mongoose.model("RefurbishmentData", RefurbishmentSchemaData);
module.exports = RefurbishmentData;

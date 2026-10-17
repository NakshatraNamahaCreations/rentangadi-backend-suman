const mongoose = require("mongoose");

const ProductManagementSchema = new mongoose.Schema({
  ProductName: {
    type: String,
    required: true
  },
  normalizedProductName: {
    type: String,
    unique: true,
  },
  ProductDesc: {
    type: String,
  },
  ProductFeature: {
    type: String,
  },
  ProductIcon: {
    type: String,
  },
  ProductSKU: {
    type: String,
  },
  ProductImg1: {
    type: String,
  },
  ProductImg2: {
    type: String,
  },
  ProductImg3: {
    type: String,
  },
  ProductIcon: {
    type: String,
  },
  ProductSubcategory: {
    type: String,
  },
  ProductCategory: {
    type: String,
  },
  ProductStock: {
    type: Number,
    required: true
  },
  StockAvailable: {
    type: Number,
    default: 0,
  },
  repairCount: {
    type: Number,
    default: 0,
  },
  lostCount: {
    type: Number,
    default: 0,
  },
  repairDescription: {
    type: String,
  },
  // StockSold: {
  //   type: Number,
  //   default: 0, 
  // },
  ProductPrice: {
    type: String,
    required: true
  },
  offerPrice: {
    type: String,
  },
  ProductGst: {
    type: String,
  },
  Productdetails: {
    type: String,
  },
  seater: {
    type: String,
  },
  Material: {
    type: String,
  },
  ProductSize: {
    type: String,
  },
  Color: {
    type: String,
  },
  qty: {
    type: Number,
    default: 0,
  },
  minqty: {
    type: String,
    default: 1,
  },
  Dates: {
    type: Array,
    default: [],
  },
  ProductStatus: {
    type: String,
    default: "Processing",
  },
  activeStatus: {
    type: Boolean,
    default: true,
  },
  images: {
    type: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true },
        color: { type: String, default: "" },
      },
    ],
    default: [],
  },
}, { timestamps: true });

const ProductManagementModel = mongoose.model(
  "Product",
  ProductManagementSchema
);
module.exports = ProductManagementModel;

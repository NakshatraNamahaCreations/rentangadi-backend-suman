const mongoose = require("mongoose");

const EnquirySchema = new mongoose.Schema(
  {
    enquiryId: { type: Number, unique: true, required: true },
    enquiryDate: {
      type: String,
      require: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    executiveId: {
      type: mongoose.Schema.Types.ObjectId,      
    },
    userId:{
      type: String,
      required: false,
    },
    endDate: {
      type: String,
      require: true,
    },
    enquiryTime: {
      type: String,
      require: true,
    },
    // clientId: {
    //   type: String,
    //   require: true,
    // },
    clientName: {
      type: String,
      require: true,
    },
    executivename: {
      type: String,
      require: true,
    },
    products: {
      type: Array,
    },
    workerAmt: {
      type: Number,
    },
    category: {
      type: String,
      require: true,
    },
    followupStatus: {
      type: String,
      default: "",
    },
    GST: {
      type: Number,
    },
    GrandTotal: {
      type: Number,
      require: true,
    },

    adjustments: {
      type: Number,
    },
    discount: {
      type: Number,
    },
    status: {
      type: String,
      default: "not send",
      enum: ["not send", "sent"],
    },
    termsandCondition: {
      type: Array,
    },
    clientNo: {
      type: String,
    },
    address: {
      type: String,
    },
    placeaddress: {
      type: String,
    },
    hasBeenUpdated: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

/* See the note in model/order.js. enquiryDate is what the enquiry calendar
   filters a month by; enquiryId already carries a unique index. */
EnquirySchema.index({ enquiryDate: 1 });
EnquirySchema.index({ createdAt: -1 });

const Enquirymodel = mongoose.model("Enquiry", EnquirySchema);
module.exports = Enquirymodel;

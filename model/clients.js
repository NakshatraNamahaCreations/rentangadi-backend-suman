const mongoose = require("mongoose");

const ClientSchema = new mongoose.Schema(
  {
    // phoneNumber: {
    //   type: String,
    //   required: true,
    // },
    // password: {
    //   type: String,
    //   required: true,
    //   minlength: 6,
    // },
    clientName: {
      type: String,
      require: true,
    },
    address: {
      type: String,
      // require: true,
    },
    isActive: {
      type: Boolean,
      default: true
    },
    executives: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Executive' }],
    // clientAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },  // SuperAdmin who created this client
    permissions: {
      addNewEnquiry: { type: Boolean, default: true },
      executiveManagement: { type: Boolean, default: true },
      viewOrders: { type: Boolean, default: true },
    },
  }, { timestamps: true, }
);

const Clientmodel = mongoose.model("client", ClientSchema);
module.exports = Clientmodel;

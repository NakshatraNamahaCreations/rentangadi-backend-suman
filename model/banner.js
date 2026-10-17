const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema({
  banner: {
    type: String,
  },
  bannerurl: {
    type: String,
  },
  subcategory: {
    type: String,
  },

}, {
  timestamps: true,
},);

const bannermodel = mongoose.model("banner", bannerSchema);
module.exports = bannermodel;

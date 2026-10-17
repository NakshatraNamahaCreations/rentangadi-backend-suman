const mongoose = require("mongoose");

const TermsandConditionSchema = new mongoose.Schema({
  category: {
    type: String,
  },
  points: {
    type: Array,
  },
  desc: {
    type: String,
  },
  header: {
    type: String,
  },
});

const TermsandConditionModel = mongoose.model(
  "TermsandCondition",
  TermsandConditionSchema
);
module.exports = TermsandConditionModel;

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const executiveSchema = new mongoose.Schema({
  // phoneNumber: {
  //   type: String,
  //   required: true,
  // },
  // password: {
  //   type: String,
  //   required: true,
  //   minlength: 6,
  // },
  clientId: {
    type: mongoose.Types.ObjectId,
    ref: 'Client',
    required: true,
  },
  executiveName: {
    type: String,
    required: true,
  },
  permissions: {
    addNewEnquiry: { type: Boolean, default: true },
    viewOrders: { type: Boolean, default: true },
  },
}, { timestamps: true });

executiveSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

executiveSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const Executive = mongoose.model('Executive', executiveSchema);

module.exports = Executive;

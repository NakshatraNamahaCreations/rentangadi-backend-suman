const mongoose = require("mongoose");

// Define the Counter Schema
const CounterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // Unique name for the counter
  seq: { type: Number, default: 0 }, // Current sequence value
});

// Static method to get the next sequence
CounterSchema.statics.getNextSequence = async function (name) {
  const counter = await this.findOneAndUpdate(
    { name }, // Match the counter by name
    { $inc: { seq: 1 } }, // Increment the sequence value
    { new: true, upsert: true } // Create the counter if it doesn't exist
  );
  return counter.seq;
};

// Export the Counter Model
module.exports = mongoose.model("Counter", CounterSchema);

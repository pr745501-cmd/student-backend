const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  title: String,
  description: String,
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  status: {
    type: String,
    enum: ["not_started", "in_progress", "complete"],
    default: "not_started"
  },
  verified: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model("Task", taskSchema);
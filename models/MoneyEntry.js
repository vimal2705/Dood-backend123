const mongoose = require("mongoose");

const moneyEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["in", "out", "save"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    category: {
      type: String,
      enum: [
        "food",
        "rent",
        "travel",
        "fun",
        "bills",
        "health",
        "work",
        "income",
        "save",
        "other",
      ],
      default: "other",
    },
    dreamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dream",
      default: null,
    },
    happenedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

moneyEntrySchema.index({ userId: 1, happenedAt: -1 });
moneyEntrySchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model("MoneyEntry", moneyEntrySchema);

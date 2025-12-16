const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletTransactionSchema = new Schema({
  type: {
    type: String,
    enum: ["Credit", "Debit"],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    default: ""
  },
  orderId: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const walletSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "user",
    required: true,
    unique: true
  },

  balance: {
    type: Number,
    default: 0
  },

  transactions: [walletTransactionSchema]
});

module.exports = mongoose.model("wallet", walletSchema);

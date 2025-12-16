const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true
    },

    discountType: {
      type: String,
      enum: ["percentage", "flat"],
      required: true
    },

    discountValue: {
      type: Number,
      required: true
    },

    maxDiscount: {
      type: Number,
      default: 0 // only applies for percentage type
    },

    minPurchase: {
      type: Number,
      default: 0
    },

    maxUsage: {
      type: Number,
      required: true,
      default: 1 // how many total times coupon can be used
    },

    usedCount: {
      type: Number,
      default: 0
    },

    usedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public"
    },

    expiry: {
      type: Date,
      required: true
    },

    status: {
      type: String,
      enum: ["active", "expired", "disabled"],
      default: "active"
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Coupon", couponSchema);

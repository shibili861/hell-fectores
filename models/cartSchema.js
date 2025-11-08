const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  items: [
    {
      productId: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        default: 1,
        min: 1,
      },
      price: {
        type: Number,
        required: true,
        min: 0,
      },
      totalprice: {
        type: Number,
        required: true,
        min: 0,
      },
      size: {
        type: String,
         default: null, // ✅ Added this field
      },
      status: {
        type: String,
        default: "placed",
      },
      cancellationReason: {
        type: String,
        default: "none",
      },
    },
  ],
});

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;

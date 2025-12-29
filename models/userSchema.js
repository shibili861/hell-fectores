const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
 phone: {
  type: String
},

  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    required: false
  },
  profileImage: {             // ✅ <--- ADD THIS
    type: String,
    default: null
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  cart: [{
    type: Schema.Types.ObjectId,
    ref: 'cart'
  }],
  wallet: [{
    type: Schema.Types.ObjectId,
    ref: 'wishlist'
  }],
  orderHistory: [{
    type: Schema.Types.ObjectId,
    ref: "order"
  }],
  createdOn: {
    type: Date,
    default: Date.now
  },
 referralCode: { type: String },
redeemed: { type: Boolean, default: false },
referralPromptShown: { type: Boolean, default: false },
redeemedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],

  resetPasswordToken: String,
  resetPasswordExpire: Date,
  searchHistory: [{
    category: {
      type: Schema.Types.ObjectId,
      ref: "category"
    },
    brand: {
      type: String
    },
    searchOn: {
      type: Date,
      default: Date.now
    }
  }]
});
userSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phone: { $exists: true, $ne: "" }
    }
  }
);


const User = mongoose.model("user", userSchema);
module.exports = User;

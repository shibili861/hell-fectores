const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

// Sub-schema for individual order items
const orderedItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    default: 0
  },
  size: { type: String, required: true },

  // Track individual item-level status INCLUDING "Out for Delivery"
  status: {
  type: String,
  enum: [
    'Pending',
    'Processing',
    'Shipped',
    'Out for Delivery',
    'Delivered',
    'Cancelled',
    'Returned',
    'Return Rejected',   // ✅ ADD THIS
    'requested'
  ],
  default: 'Pending'
},


  cancelReason: { type: String },
  returnReason: { type: String },

   returnRequested: { type: Boolean, default: false },

  // NEW RETURN SYSTEM FIELDS
  returnRequestedAt: { type: Date, default: null },
  returnApproved: { type: Boolean, default: false },
  returnRejected: { type: Boolean, default: false },
  rejectReason: { type: String, default: null },
  returnedOn: { type: Date, default: null },


}, { timestamps: true });


// Main order schema
const orderSchema = new Schema({
  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },

  orderedItems: [orderedItemSchema],

  totalPrice: {
    type: Number,
    required: true
  },

  discount: {
    type: Number,
    default: 0
  },

  finalAmount: {
    type: Number,
    required: true
  },

  address: {
    type: Object,
    required: true
  },

  paymentMethod: {
    type: String,
    enum: ['COD', 'Online'],
    default: 'COD'
  },

  // ✅ Main order-level status
 status: {
  type: String,
  enum: [
    'Pending',
    'Processing',
    'Shipped',
    'Out for Delivery',
    'Delivered',
    'Cancelled',
    'Returned',
    'Return Rejected',   // <<< YOU MUST ADD HERE
    'requested'
  ],
  default: 'Pending'
},

  rejectReason: { type: String, default: null },
rejectedOn: { type: Date, default: null },


  invoiceDate: {
    type: Date,
    default: Date.now
  },

  couponApplied: {
    type: Boolean,
    default: false
  },

  createdOn: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);

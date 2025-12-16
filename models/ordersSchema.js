const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');



// ⭐ Generate formatted order ID
function generateOrderId() {
  const prefix = "ORD";           // Customize your prefix
  const date = new Date();

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  // Unique 5-digit incremental-like random number
  const rand = Math.floor(10000 + Math.random() * 90000);

  return `${prefix}-${y}${m}${d}-${rand}`;
}





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
      'Return Rejected',
      'requested',
      'Payment Failed'    
    ],
    default: 'Pending'
  },

  cancelReason: { type: String },
  returnReason: { type: String },

  returnRequested: { type: Boolean, default: false },
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
   default: () => generateOrderId(),

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
  enum: ['COD', 'Online', 'Wallet'],
  default: 'COD'
},


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
      'Return Rejected',
      'requested',
      'Payment Failed' 
    ],
    default: 'Pending'
  },

  /** ⭐ ADD THESE FIELDS ⭐ **/
  razorpayOrderId: { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },

paymentStatus: {
  type: String,
  enum: ["Pending", "Paid", "Failed"],
  default: "Pending"
}
,



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
  couponCode: {
    type: String,
    default: null
},
couponDiscount: {
    type: Number,
    default: 0
},


  createdOn: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);

// const mongoose = require('mongoose');
// const { Schema } = mongoose;

// const productSchema = new Schema({
//     productName: {
//         type: String,
//         required: true,
//         trim: true
//     },
//     description: {
//         type: String,
//         required: true,
//     },
//     category: {
//         type: Schema.Types.ObjectId,
//         ref: "Category",
//         required: true,
//     },
//     regularPrice: { 
//         type: Number,
//         required: true,
//         min: 0
//     },
//     salePrice: {
//         type: Number,
//         required: true, 
//         min: 0
//     },
//     productOffer: {
//         type: Number,
//         default: 0,
//         min: 0,
//         max: 100 
//     },
//     quantity: { 
//         type: Number,
//         required: true, 
//         min: 0,
//         default: 0
//     },
//     productImage: {
//         type: [String],
//         required: true
//     },
//     isBlocked: {
//         type: Boolean,
//         default: false
//     },
//     status: {
//         type: String,
//         enum: ['Available', 'Out of stock', 'Discontinued'], 
//         default: "Available"
//     }
// }, { timestamps: true });

// const Product = mongoose.model("Product", productSchema); 
// module.exports = Product;
const mongoose = require('mongoose');
const { Schema } = mongoose;

const sizeVariantSchema = new Schema({
  size: {
    type: String,
    required: true,
    enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  }
  // Removed individual price field
});

const productSchema = new Schema({
  productName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  regularPrice: { 
    type: Number,
    required: true,
    min: 0
  },
  salePrice: {
    type: Number,
    required: true, 
    min: 0
  },
  productOffer: {
    type: Number,
    default: 0,
    min: 0,
    max: 100 
  },
  quantity: { 
    type: Number,
    required: true, 
    min: 0,
    default: 0
  },
  productImage: {
    type: [String],
    required: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Available', 'Out of stock', 'Discontinued'], 
    default: "Available"
  },
  // Add size variants (only size and quantity)
  sizeVariants: [sizeVariantSchema],
  // Add field to track if product has variants
  hasVariants: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema); 
module.exports = Product;
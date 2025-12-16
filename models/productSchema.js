
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
    required:false, 
    min: 0,
    default: 0
  },
  productOffer: {
    type: Number,
    default: 0,
    min: 0,
    max: 100 
  },
  effectiveOffer: {
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
  
  hasVariants: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });



// NEW OFFER LOGIC STARTS HERE
const Category = require("./categorySchema");

productSchema.methods.applyBestOffer = async function () {
  const regular = Number(this.regularPrice) || 0;
  const productOffer = Number(this.productOffer) || 0;

  let categoryOffer = 0;
  if (this.category) {
    const cat = await Category.findById(this.category).select("categoryOffer");
    if (cat) categoryOffer = Number(cat.categoryOffer) || 0;
  }

  const bestOffer = Math.max(productOffer, categoryOffer);
  this.salePrice = Math.round(regular * (1 - bestOffer / 100));
  this.effectiveOffer = bestOffer;
};

productSchema.pre("save", async function (next) {
  try {
    await this.applyBestOffer();
    next();
  } catch (error) {
    next(error);
  }
});
const Product = mongoose.model("Product", productSchema); 
module.exports = Product;
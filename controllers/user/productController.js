const Product=require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const User=require("../../models/userSchema");

const Wishlist = require("../../models/wishlistSchema");




const mongoose = require("mongoose");

const productDetails = async (req, res) => {
  try {
    const productId = req.query.id;
console.log("Product ID:", req.query.id);

    // 🔑 validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(404).render("user/page-404");
    }

    const product = await Product
      .findById(productId)
      .populate("category");

    if (!product || product.isBlocked) {
      return res.status(404).render("user/page-404");
    }

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id }
    }).limit(3);

    // wishlist check (already done earlier)
    let isWishlisted = false;
    if (req.session.userId) {
      const wishlist = await Wishlist.findOne({
        userId: req.session.userId,
        "products.productId": productId
      });
      if (wishlist) isWishlisted = true;
    }

    res.render("user/productsDetailpage", {
      product,
      relatedProducts,
      isWishlisted
    });

  } catch (err) {
    console.error("Product Details Error:", err);
    res.status(500).render("user/page-404");
  }
};

module.exports={
    productDetails,
   

}




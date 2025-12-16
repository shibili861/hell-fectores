
const mongoose = require('mongoose');
const Wishlist =require("../../models/wishlistSchema")
const Product = require("../../models/productSchema")
const Cart = require("../../models/cartSchema");
const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId } = req.body;

    if (!userId) {
      return res.json({ success: false, message: "Login required" });
    }

    const product = await Product.findById(productId);
    if (!product || product.isBlocked) {
      return res.json({ success: false, message: "Product unavailable" });
    }

    let wishlist = await Wishlist.findOne({ userId });

    // If wishlist does not exist → create & ADD
    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        products: [{ productId }]
      });

      await wishlist.save();

      return res.json({
        success: true,
        added: true,
        message: "Added to wishlist"
      });
    }

    // Check if product exists
    const index = wishlist.products.findIndex(
      p => p.productId.toString() === productId
    );

    // EXISTS → REMOVE
    if (index !== -1) {
      wishlist.products.splice(index, 1);
      await wishlist.save();

      return res.json({
        success: true,
        removed: true,
        message: "Removed from wishlist"
      });
    }

    // DOES NOT EXIST → ADD
    wishlist.products.push({ productId });
    await wishlist.save();

    return res.json({
      success: true,
      added: true,
      message: "Added to wishlist"
    });

  } catch (err) {
    console.error("Wishlist Toggle Error:", err);
    return res.json({
      success: false,
      message: "Something went wrong"
    });
  }
};


const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId } = req.body;

    if (!userId) return res.json({ success: false, message: "Login required" });

    await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId } } }
    );

    return res.json({ success: true, message: "Removed from wishlist" });

  } catch (err) {
    console.error("Remove Wishlist Error:", err);
    res.json({ success: false, message: "Something went wrong" });
  }
};
const getWishlistPage = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) return res.redirect("/login");

    let wishlist = await Wishlist.findOne({ userId })
      .populate("products.productId");

    //  If wishlist does NOT exist send an empty structure instead of null
    if (!wishlist) {
      wishlist = { products: [] };
    }

    return res.render("user/wishlist", { wishlist });

  } catch (err) {
    console.log("Wishlist Page Error:", err);
    return res.redirect("/");
  }
};


const getWishlistCount = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.json({ count: 0 });

    const wishlist = await Wishlist.findOne({ userId });
    const count = wishlist ? wishlist.products.length : 0;

    res.json({ count });

  } catch (err) {
    console.error("Wishlist Count Error:", err);
    res.json({ count: 0 });
  }
};





module.exports={
    addToWishlist ,
    removeFromWishlist,
    getWishlistPage,
    getWishlistCount 


}
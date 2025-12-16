const mongoose = require("mongoose");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Coupon = require("../../models/couponSchema");

const Address = require("../../models/addressSchema");
const Order=require("../../models/ordersSchema")
const razorpay = require("../../config/razorpay");
const Wallet = require("../../models/walletSchema");


function calculateTotals(cart) {
  let subtotal = 0;

  cart.items.forEach(item => {
    subtotal += item.totalprice;
  });

  // ⭐ NEW RULE: Free shipping above ₹2000
  let shipping = subtotal >= 2000 ? 0 : 49;

  const total = subtotal + shipping;

  cart.subtotal = subtotal;
  cart.shipping = shipping;
  cart.total = total;

  return { subtotal, shipping, total };
}

const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect("/login");

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) return res.redirect("/cart");

    // 🛑 Remove blocked or missing products
    const invalidItems = cart.items.filter(
      (item) => !item.productId || item.productId.isBlocked === true
    );

    if (invalidItems.length > 0) {
      cart.items = cart.items.filter(
        (item) => item.productId && !item.productId.isBlocked
      );
      await cart.save();
      return res.redirect("/cart?blocked=true");
    }

   //  Get shipping/subtotal/total from unified function
const { subtotal, shipping, total } = calculateTotals(cart);

// TAX remains separate if you want it (5%)
const tax = subtotal * 0.05;

// final total includes shipping + tax (coupon applied later)
let baseTotal = subtotal + shipping + tax;


    let discount = 0;
    let appliedCoupon = null;

    if (req.session.coupon) {
      discount = req.session.coupon.discount || 0;
      appliedCoupon = req.session.coupon;
    }

    const finalTotal = subtotal + tax + shipping - discount;

    // 🏠 Get Address
    const addressDoc = await Address.findOne({ userId });
    const latestAddress = addressDoc?.address[addressDoc.address.length - 1] || null;

    // 🏷️ Fetch Coupons
    const coupons = await Coupon.find({
      isActive: true,
      expiry: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    // 👛 Fetch Wallet
    let wallet = await Wallet.findOne({ userId });

    // If user doesn't have a wallet → create it
    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        transactions: []
      });
    }

    // 🎯 Render Page
    res.render("user/checkout", {
      cart,
      address: latestAddress,
      subtotal,
      tax,
      shipping,
      finalTotal,
      appliedCoupon,
      coupons,
      wallet,               // <<-- IMPORTANT FOR EJS
      user: { _id: userId } // keeping your original structure
    });

  } catch (error) {
    console.error("Checkout Page Error:", error);
    res.redirect("/error");
  }
};

module.exports = {
  getCheckoutPage,
};

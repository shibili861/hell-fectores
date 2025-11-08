const mongoose = require("mongoose");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Order=require("../../models/ordersSchema")

const getCheckoutPage = async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.redirect("/login");

  const cart = await Cart.findOne({ userId }).populate("items.productId");
  if (!cart || cart.items.length === 0) return res.redirect("/cart");

  // ✅ Check for blocked or deleted products
  const invalidItems = cart.items.filter(
    (item) => !item.productId || item.productId.isBlocked === true
  );

  if (invalidItems.length > 0) {
    // remove them from cart automatically
    cart.items = cart.items.filter(
      (item) => item.productId && !item.productId.isBlocked
    );
    await cart.save();

    // redirect user
    return res.redirect("/cart?blocked=true");
  }

  // ✅ Calculate totals
  let subtotal = cart.items.reduce((sum, item) => sum + item.totalprice, 0);
  const tax = subtotal * 0.05;
  const shipping = subtotal > 5000 ? 0 : 100;
  const finalTotal = subtotal + tax + shipping;

  const userAddressDoc = await Address.findOne({ userId });
  const latestAddress =
    userAddressDoc?.address[userAddressDoc.address.length - 1] || null;

  res.render("user/checkout", {
    cart,
    address: latestAddress,
    subtotal,
    tax,
    shipping,
    finalTotal,
  });
};



module.exports={
    getCheckoutPage,
    
}
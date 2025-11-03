const mongoose = require("mongoose");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");

const addToCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId, quantity = 1 } = req.body;
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    const product = await Product.findById(productId).populate("category");
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    if (product.isBlocked || product.status !== "Available")
      return res.status(400).json({ success: false, message: "Product unavailable" });

    if (!product.category.isListed)
      return res.status(400).json({ success: false, message: "Category unlisted" });

    let cart = await Cart.findOne({ userId });
    const unitPrice = product.salePrice || product.regularPrice;

    if (!cart) {
      cart = new Cart({ userId, items: [{ productId, quantity, price: unitPrice, totalprice: unitPrice * quantity }] });
    } else {
      const item = cart.items.find(i => i.productId.equals(productId));
      if (item) {
        const newQty = item.quantity + quantity;
        if (newQty > 3)
          return res.status(400).json({ success: false, message: "Maximum 3 items allowed per product" });
        item.quantity = newQty;
        item.totalprice = unitPrice * newQty;
      } else {
        cart.items.push({ productId, quantity, price: unitPrice, totalprice: unitPrice * quantity });
      }
    }

    await cart.save();
    res.json({ success: true, message: "Added to cart", cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Get Cart
const getCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    res.json({ success: true, cart: cart || { items: [] } });
  } catch {
    res.status(500).json({ success: false, message: "Error fetching cart" });
  }
};

// ✅ Remove Item
const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId } = req.params;
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.json({ success: true, cart: { items: [] } });

    cart.items = cart.items.filter(i => !i.productId.equals(productId));
    await cart.save();

    res.json({ success: true, message: "Item removed", cart });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error removing item" });
  }
};

// ✅ Update Quantity
const updateQuantity = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId } = req.params;
    const { quantityDelta } = req.body;

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    const item = cart.items.find(i => i.productId.equals(productId));
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    const newQty = item.quantity + Number(quantityDelta);
    if (newQty < 1) return res.json({ success: false, message: "Min quantity is 1" });
    if (newQty > 3) return res.json({ success: false, message: "Max 3 items allowed" });

    const product = await Product.findById(productId);
    const unitPrice = product.salePrice || product.regularPrice;

    item.quantity = newQty;
    item.price = unitPrice;
    item.totalprice = unitPrice * newQty;
    await cart.save();

    res.json({ success: true, message: "Quantity updated", updatedItem: item, cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


module.exports={
    addToCart,
    getCart,
    removeFromCart,
    updateQuantity



}
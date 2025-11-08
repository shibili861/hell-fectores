const mongoose = require("mongoose");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Order=require("../../models/ordersSchema");
const PDFDocument = require("pdfkit");




//  Place Order (COD)
const placeOrder = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.json({ success: false, message: 'Login required' });

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0)
      return res.json({ success: false, message: 'Cart is empty' });

    const addressDoc = await Address.findOne({ userId });
    const latestAddress = addressDoc?.address[addressDoc.address.length - 1];
    if (!latestAddress)
      return res.json({ success: false, message: 'No address found' });

    // ✅ Check stock availability
    for (const item of cart.items) {
      const product = item.productId;
      const variant = product.sizeVariants.find(v => v.size === item.size);

      if (!variant || variant.quantity < item.quantity) {
        return res.json({
          success: false,
          message: `${product.productName} (${item.size}) is out of stock`
        });
      }
    }

    // Calculate totals
    let subtotal = 0;
    cart.items.forEach(item => (subtotal += item.totalprice));

    const tax = subtotal * 0.05;
    const shipping = subtotal > 5000 ? 0 : 100;
    const finalTotal = subtotal + tax + shipping;

    const order = new Order({
      userId,
      orderedItems: cart.items.map(i => ({
        product: i.productId._id,
        size: i.size,
        quantity: i.quantity,
        price: i.totalprice / i.quantity
      })),
      totalPrice: subtotal,
      finalAmount: finalTotal,
      address: latestAddress,
      paymentMethod: 'COD',
      status: 'Pending'
    });

    await order.save();

    // ✅ Reduce only size variant stock
    for (const item of cart.items) {
      await Product.updateOne(
        { _id: item.productId._id, "sizeVariants.size": item.size },
        { $inc: { "sizeVariants.$.quantity": -item.quantity } }
      );
    }

    // ✅ Define productIds FIRST
    const productIds = [...new Set(cart.items.map(item => item.productId._id.toString()))];

    // ✅ Update total quantity after reducing variant quantity
    for (const id of productIds) {
      const updatedProduct = await Product.findById(id);
      const newTotalQty = updatedProduct.sizeVariants.reduce((sum, v) => sum + v.quantity, 0);

      await Product.updateOne(
        { _id: id },
        { $set: { quantity: newTotalQty } }
      );
    }

    // Clear cart
    await Cart.findOneAndUpdate({ userId }, { items: [] });

    return res.json({ success: true, orderId: order.orderId });

  } catch (err) {
    console.error('Place Order Error:', err);
    res.json({ success: false, message: 'Order failed, try again' });
  }
};



// Order Success Page
const orderSuccessPage = async (req, res) => {
  try {
    const { orderId } = req.query;
    const order = await Order.findOne({ orderId })
      .populate('orderedItems.product')
      .lean();

    if (!order) return res.redirect('/');

    res.render('user/order-success', { order });
  } catch (error) {
    console.error('Order Success Page Error:', error);
    res.redirect('/');
  }
};

// Order Details Page
const getOrderDetailsPage = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect('/login');

    const orderId = req.params.id;
    const order = await Order.findOne({ orderId })
      .populate('orderedItems.product')
      .lean();

    if (!order) {
      console.warn(`⚠️ Order not found for orderId: ${orderId}`);
      return res.redirect('/my-orders');
    }

    res.render('user/order-details', { order });
  } catch (err) {
    console.error('Order Details Page Error:', err);
    res.status(500).send('Something went wrong while loading order details.');
  }
};

// My Orders Page
const getMyOrdersPage = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect('/login');

    const orders = await Order.find({ userId })
      .populate('orderedItems.product')
      .sort({ createdOn: -1 })
      .lean();

    res.render('my-orders', { orders });
  } catch (err) {
    console.error('Error loading My Orders page:', err);
    res.status(500).send('Something went wrong while loading your orders.');
  }
};



//  Cancel Entire Order
const cancelOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const userId = req.session.userId;

    const order = await Order.findOne({ orderId, userId }).populate("orderedItems.product");
    if (!order) return res.json({ success: false, message: "Order not found" });

    if (order.status === "Cancelled")
      return res.json({ success: false, message: "Order already cancelled" });

    // Restock each product
    for (const item of order.orderedItems) {
      if (item.status !== "Cancelled" && item.product) {
        item.product.quantity += item.quantity;
        await item.product.save();
        item.status = "Cancelled";
        item.cancelReason = reason || "User cancelled the order";
      }
    }

    order.status = "Cancelled";
    await order.save();

    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Cancel Order Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

//  Cancel Specific Item
const cancelItem = async (req, res) => {
  try {
    const { orderId, itemId, reason } = req.body;
    const userId = req.session.userId;

    const order = await Order.findOne({ orderId, userId }).populate("orderedItems.product");
    if (!order) return res.json({ success: false, message: "Order not found" });

    const item = order.orderedItems.id(itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });
    if (item.status === "Cancelled")
      return res.json({ success: false, message: "Item already cancelled" });

    // Restock item quantity
    if (item.product) {
      item.product.quantity += item.quantity;
      await item.product.save();
    }

    item.status = "Cancelled";
    item.cancelReason = reason || "No reason provided";
    await order.save();

    res.json({ success: true, message: "Item cancelled successfully" });
  } catch (error) {
    console.error("Cancel Item Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// POST /user/return-item  (your existing endpoint)
const requestReturn = async (req, res) => {
  try {
    const { orderId, itemId, reason } = req.body;
    const userId = req.session.userId;

    if (!reason || reason.trim().length < 3) {
      return res.json({ success: false, message: "Return reason is required" });
    }

    const order = await Order.findOne({ orderId, userId }).populate('orderedItems.product');
    if (!order) return res.json({ success: false, message: "Order not found" });

    const item = order.orderedItems.id(itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });

    if (item.status !== "Delivered") {
      return res.json({ success: false, message: "Only delivered items can be returned" });
    }

    if (item.returnRequested) {
      return res.json({ success: false, message: "Return already requested for this item" });
    }

    item.returnRequested = true;
    item.returnReason = reason;
    item.returnRequestedAt = new Date();
    item.returnStatus = 'Requested';

    await order.save();

    // TODO: notify admin (email/notification) that new return request arrived.

    return res.json({ success: true, message: "Return request submitted successfully" });
  } catch (error) {
    console.error("Return Request Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};







module.exports={
     placeOrder ,
     orderSuccessPage,
     getOrderDetailsPage,
     getMyOrdersPage,
      cancelOrder,
      cancelItem,
      requestReturn,


}
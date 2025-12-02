const mongoose = require("mongoose");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Order=require("../../models/ordersSchema");
const PDFDocument = require("pdfkit");
const razorpay = require("../../config/razorpay");

const crypto = require("crypto");



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

    //  Check stock availability
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

    // Reduce only size variant stock
    for (const item of cart.items) {
      await Product.updateOne(
        { _id: item.productId._id, "sizeVariants.size": item.size },
        { $inc: { "sizeVariants.$.quantity": -item.quantity } }
      );
    }

    
    const productIds = [...new Set(cart.items.map(item => item.productId._id.toString()))];

    //  Update total quantity after reducing variant quantity
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
      console.warn(` Order not found for orderId: ${orderId}`);
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

// Cancel Entire Order
const cancelOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const userId = req.session.userId;

    const order = await Order.findOne({ orderId, userId })
      .populate("orderedItems.product");

    if (!order) return res.json({ success: false, message: "Order not found" });

    if (order.status === "Cancelled")
      return res.json({ success: false, message: "Order already cancelled" });

    for (const item of order.orderedItems) {
      if (item.status !== "Cancelled" && item.product) {

        if (item.size && item.product.hasVariants) {
          const variant = item.product.sizeVariants.find(v => v.size === item.size);
          if (variant) variant.quantity += item.quantity;

          // ⭐ FIX: Recalculate full stock
          item.product.quantity = item.product.sizeVariants.reduce(
            (sum, v) => sum + v.quantity,
            0
          );

        } else {
          item.product.quantity += item.quantity;
        }

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

// Cancel Specific Item
const cancelItem = async (req, res) => {
  try {
    const { orderId, itemId, reason } = req.body;
    const userId = req.session.userId;

    const order = await Order.findOne({ orderId, userId })
      .populate("orderedItems.product");

    if (!order) return res.json({ success: false, message: "Order not found" });

    const item = order.orderedItems.id(itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });

    if (item.status === "Cancelled")
      return res.json({ success: false, message: "Item already cancelled" });

    if (item.product) {

      if (item.size && item.product.hasVariants) {
        const variant = item.product.sizeVariants.find(v => v.size === item.size);
        if (variant) variant.quantity += item.quantity;

        // ⭐ FIX: Update total quantity based on all variant quantities
        item.product.quantity = item.product.sizeVariants.reduce(
          (sum, v) => sum + v.quantity, 
          0
        );

      } else {
        // No variant → normal quantity update
        item.product.quantity += item.quantity;
      }

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


// USER — REQUEST RETURN
const requestReturn = async (req, res) => {
  try {
    const { orderId, itemId, reason } = req.body;
    const userId = req.session.userId;

    if (!reason || reason.trim().length < 3) {
      return res.json({ success: false, message: "Return reason is required" });
    }

    const order = await Order.findOne({ orderId, userId }).populate("orderedItems.product");
    if (!order) return res.json({ success: false, message: "Order not found" });

    const item = order.orderedItems.id(itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });

    // ensure user cannot return rejected or approved items again
    if (item.returnApproved) {
      return res.json({ success: false, message: "Return already approved — cannot request again" });
    }

    if (item.returnRejected) {
      return res.json({ success: false, message: "Return was rejected — cannot request again" });
    }

    if (item.returnRequested) {
      return res.json({ success: false, message: "Return already requested" });
    }

    if (item.status !== "Delivered") {
      return res.json({ success: false, message: "Only delivered items can be returned" });
    }

    // create return request
    item.returnRequested = true;
    item.returnReason = reason;
    item.returnRequestedAt = new Date();

    await order.save();

    return res.json({ success: true, message: "Return request submitted successfully" });

  } catch (error) {
    console.error("Return Request Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.json({ success: false, message: "Login required" });

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0)
      return res.json({ success: false, message: "Cart empty" });

    const addressDoc = await Address.findOne({ userId });
    const latestAddress = addressDoc?.address[addressDoc.address.length - 1];
    if (!latestAddress) return res.json({ success: false, message: "Address required" });

    // totals (same logic)
    let subtotal = cart.items.reduce((sum, i) => sum + i.totalprice, 0);
    const tax = subtotal * 0.05;
    const shipping = subtotal > 5000 ? 0 : 100;
    const finalAmount = subtotal + tax + shipping;
    const amountInPaise = Math.round(finalAmount * 100);

    // create razorpay order
    const rOptions = {
      amount: amountInPaise,
      currency: "INR",
      receipt: "rcpt_" + Date.now(),
    };

    const rOrder = await razorpay.orders.create(rOptions);

    // create a provisional internal order so we can show order details even if payment fails
    const provisionalOrder = new Order({
      userId,
      orderedItems: cart.items.map(i => ({
        product: i.productId._id,
        size: i.size,
        quantity: i.quantity,
        price: i.totalprice / i.quantity
      })),
      totalPrice: subtotal,
      finalAmount,
      address: latestAddress,
      paymentMethod: "Online",
      status: "Pending",                 // or 'Pending Payment'
      paymentStatus: "Pending Payment",  // optional
      razorpayOrderId: rOrder.id
    });

    await provisionalOrder.save();

    return res.json({
      success: true,
      razorpayOrderId: rOrder.id,
      amountInPaise,
      key: process.env.RAZORPAY_KEY_ID,
      internalOrderId: provisionalOrder.orderId  // return your internal order id
    });

  } catch (err) {
    console.error("Create Razorpay Error:", err);
    return res.json({ success: false, message: "Payment initiation failed" });
  }
};const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, internalOrderId } = req.body;

    // Validate required values
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !internalOrderId) {
      return res.json({ success: false, message: "Missing parameters" });
    }

    // Verify payment signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await Order.findOneAndUpdate(
        { orderId: internalOrderId },
        {
          paymentStatus: "Payment Failed",
          status: "Payment Failed",
          "orderedItems.$[].status": "Payment Failed"
        }
      );
      return res.json({ success: false, message: "Invalid signature" });
    }

    // Get user & order
    const userId = req.session.userId;
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const internalOrder = await Order.findOne({ orderId: internalOrderId });

    if (!internalOrder) return res.json({ success: false, message: "Order not found" });

    // 🟢 PAYMENT SUCCESS → Update all status fields
    internalOrder.razorpayPaymentId = razorpay_payment_id;
    internalOrder.paymentStatus = "Success";
    internalOrder.status = "Processing";

    internalOrder.orderedItems.forEach(item => {
      item.status = "Processing";   // Fix missing item-level update
    });

    await internalOrder.save();

    // 🟢 Reduce stock after payment succeeds
    for (const item of internalOrder.orderedItems) {
      await Product.updateOne(
        { _id: item.product, "sizeVariants.size": item.size },
        { $inc: { "sizeVariants.$.quantity": -item.quantity } }
      );
    }

    // Update total quantity
    const productIds = [...new Set(internalOrder.orderedItems.map(i => i.product.toString()))];
    for (const id of productIds) {
      const prod = await Product.findById(id);
      const newQty = prod.sizeVariants.reduce((s, v) => s + v.quantity, 0);
      await Product.updateOne({ _id: id }, { $set: { quantity: newQty } });
    }

    // 🟢 Clear cart AFTER success
    await Cart.findOneAndUpdate({ userId }, { items: [] });

    return res.json({ success: true, orderId: internalOrder.orderId });

  } catch (err) {
    console.error("Verify Razorpay Error:", err);
    return res.json({ success: false, message: "Something went wrong" });
  }
};

const markPaymentFailed = async (req, res) => {
  try {
    const { internalOrderId, reason } = req.body;

    if (!internalOrderId)
      return res.json({ success: false, message: "Missing order id" });

    await Order.findOneAndUpdate(
      { orderId: internalOrderId },
      {
        paymentStatus: "Payment Failed",
        status: "Payment Failed",
        rejectReason: reason || "Payment failed or cancelled",
        "orderedItems.$[].status": "Payment Failed"   // ✅ IMPORTANT FIX
      }
    );

    return res.json({ success: true });

  } catch (err) {
    console.error("Mark Payment Failed Error:", err);
    return res.json({ success: false });
  }
};


const retryPayment = async (req, res) => {
  try {
    const { internalOrderId } = req.body;
    console.log("Retry Payment Triggered For Order:", internalOrderId);

    if (!internalOrderId) 
      return res.json({ success: false, message: "Order id required" });

    console.log("Retry Payment Body:", req.body);

    const order = await Order.findOne({ orderId: internalOrderId });
    if (!order) 
      return res.json({ success: false, message: "Order not found" });

    // Create new Razorpay order
    const amountInPaise = Math.round(order.finalAmount * 100);

    const rOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: "retry_rcpt_" + Date.now(),
    });

    console.log("Razorpay retry response:", rOrder);

    // Update internal order
    order.razorpayOrderId = rOrder.id;
    order.paymentStatus = "Pending Payment";
    order.status = "Pending";

    console.log("Found Order:", order);

    await order.save();

    return res.json({
      success: true,
      razorpayOrderId: rOrder.id,
      amountInPaise,
      key: process.env.RAZORPAY_KEY_ID,
      internalOrderId: order.orderId
    });

  } catch (err) {
    console.error("Retry Payment Error:", err);
    return res.json({ success: false, message: "Retry failed" });
  }
};

const orderFailurePage = async (req, res) => {
  const { orderId } = req.query;
  const order = await Order.findOne({ orderId }).populate('orderedItems.product').lean();
  if (!order) return res.redirect("/");

  res.render("user/order-failure", { order });
};


module.exports={
     placeOrder ,
     orderSuccessPage,
     getOrderDetailsPage,
     getMyOrdersPage,
      cancelOrder,
      cancelItem,
      requestReturn,
      createRazorpayOrder,
  verifyRazorpayPayment,
  markPaymentFailed,
  retryPayment,
  orderFailurePage

}
const mongoose = require("mongoose");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Order=require("../../models/ordersSchema");
const PDFDocument = require("pdfkit");
const razorpay = require("../../config/razorpay");
const Coupon = require("../../models/couponSchema");
const wallet=require("../../models/walletSchema");
const { creditWallet, debitWallet } = require("../../helpers/walletHelper");

const crypto = require("crypto");
const placeOrder = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.json({ success: false, message: 'Login required' });

    const { paymentMethod } = req.body;
   
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0)
      return res.json({ success: false, message: 'Cart is empty' });

    const addressDoc = await Address.findOne({ userId });
    const latestAddress = addressDoc?.address[addressDoc.address.length - 1];
    if (!latestAddress)
      return res.json({ success: false, message: 'No address found' });

    // stock check
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

    let subtotal = 0;
    cart.items.forEach(item => (subtotal += item.totalprice));

    const tax = subtotal * 0.03;
    const shipping = subtotal >= 2000 ? 0 : 49;
    const discount = req.session.coupon ? req.session.coupon.discount : 0;
    const finalTotal = subtotal + tax + shipping - discount;

    if (paymentMethod === "Razorpay") {
      return res.json({
        success: false,
        message: "Use Razorpay flow for online payment"
      });
    }

    let paymentStatus = "Pending";
    if (paymentMethod === "Wallet") {
      const user = await User.findById(userId);
      if (!user) return res.json({ success: false });

      if (user.walletBalance < finalTotal) {
        return res.json({
          success: false,
          message: "Insufficient wallet balance"
        });
      }

      paymentStatus = "Paid";
    }

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
      discount,
      couponApplied: req.session.coupon ? true : false,
      couponCode: req.session.coupon ? req.session.coupon.code : null,
      couponDiscount: req.session.coupon ? req.session.coupon.discount : 0,
      address: latestAddress,
      paymentMethod: paymentMethod || "COD",
      status: 'Pending',
      paymentStatus
    });

    await order.save();

    if (paymentMethod === "Wallet") {
      await debitWallet(
        userId,
        finalTotal,
        `Payment for order ${order.orderId}`,
        order.orderId
      );
    }

    if (req.session.coupon) {
      await Coupon.updateOne(
        { code: req.session.coupon.code },
        { $addToSet: { usedUsers: userId } }
      );
      req.session.coupon = null;
    }

    // 🔧 FIX: parallel stock update (NO DELAY)
    await Promise.all(
      cart.items.map(item =>
        Product.updateOne(
          { _id: item.productId._id, "sizeVariants.size": item.size },
          { $inc: { "sizeVariants.$.quantity": -item.quantity } }
        )
      )
    );

    const productIds = [...new Set(cart.items.map(i => i.productId._id.toString()))];

    // 🔧 FIX: parallel total quantity update
    await Promise.all(
      productIds.map(async id => {
        const p = await Product.findById(id);
        const qty = p.sizeVariants.reduce((s, v) => s + v.quantity, 0);
        return Product.updateOne({ _id: id }, { $set: { quantity: qty } });
      })
    );

    // 🔧 FIX: ensure cart really clears
    const clearedCart = await Cart.findOneAndUpdate(
      { userId },
      { $set: { items: [] } },
      { new: true }
    );

    if (!clearedCart) {
      console.error("Cart clear failed for user:", userId);
    }

    return res.json({ success: true, orderId: order.orderId });

  } catch (err) {
    console.error('Place Order Error:', err);
    res.json({ success: false, message: 'Order failed, try again' });
  }
};


// Order Success Page
const orderSuccessPage = async (req, res) => {
  try {
   const { orderId } = req.params;

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

    // ==============================
    // 🟡 RESTORE STOCK FOR EACH ITEM
    // ==============================
    for (const item of order.orderedItems) {
      if (item.status !== "Cancelled" && item.product) {

        if (item.size && item.product.hasVariants) {
          const variant = item.product.sizeVariants.find(v => v.size === item.size);
          if (variant) variant.quantity += item.quantity;

          // Recalculate full stock
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

    // ======================================
    // 🟢 WALLET REFUND LOGIC (MAIN ADDITION)
    // ======================================
    const refundMethods = ["Online", "Wallet"];
    if (refundMethods.includes(order.paymentMethod)) {

      const refundAmount = order.finalAmount;

      await creditWallet(
        userId,
        refundAmount,
        `Refund for cancelled order ${order.orderId}`,
        order.orderId
      );
    }

    return res.json({ success: true, message: "Order cancelled successfully" });

  } catch (error) {
    console.error("Cancel Order Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// Cancel Specific Item
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

    // ==============================
    // 🟡 RESTOCK THE ITEM
    // ==============================
    if (item.product) {

      if (item.size && item.product.hasVariants) {
        const variant = item.product.sizeVariants.find(v => v.size === item.size);
        if (variant) variant.quantity += item.quantity;

        // Update total quantity
        item.product.quantity = item.product.sizeVariants.reduce(
          (sum, v) => sum + v.quantity, 
          0
        );

      } else {
        item.product.quantity += item.quantity;
      }

      await item.product.save();
    }

    // Mark item cancelled
    item.status = "Cancelled";
    item.cancelReason = reason || "No reason provided";

    await order.save();

    // ======================================
    // 🟢 PARTIAL WALLET REFUND LOGIC
    // ======================================
    const refundMethods = ["Online", "Wallet"];
    if (refundMethods.includes(order.paymentMethod)) {

      const refundAmount = item.price * item.quantity;

      await creditWallet(
        userId,
        refundAmount,
        `Refund for cancelled item in order ${order.orderId}`,
        order.orderId
      );
    }

    // If ALL items cancelled → cancel entire order
    const allCancelled = order.orderedItems.every(i => i.status === "Cancelled");
    if (allCancelled) {
      order.status = "Cancelled";
      await order.save();
    }

    return res.json({ success: true, message: "Item cancelled successfully" });

  } catch (error) {
    console.error("Cancel Item Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
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
    const userId = req.session.userId; // ✅ CORRECT

    if (!userId) return res.json({ success: false, message: "Login required" });

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0)
      return res.json({ success: false, message: "Cart empty" });

    const addressDoc = await Address.findOne({ userId });
    const latestAddress = addressDoc?.address.at(-1);
    if (!latestAddress) return res.json({ success: false, message: "Address required" });

    let subtotal = cart.items.reduce((s, i) => s + i.totalprice, 0);
    const tax = subtotal * 0.05;
    const shipping = subtotal >= 2000 ? 0 : 49;

    const discount = req.session.coupon?.discount || 0;
    const finalAmount = subtotal + tax + shipping - discount;

    const rOrder = await razorpay.orders.create({
      amount: Math.round(finalAmount * 100),
      currency: "INR",
      receipt: "rcpt_" + Date.now(),
    });

    const order = new Order({
      userId,
      orderedItems: cart.items.map(i => ({
        product: i.productId._id,
        size: i.size,
        quantity: i.quantity,
        price: i.totalprice / i.quantity
      })),
      totalPrice: subtotal,
      finalAmount,
      discount,
      couponApplied: discount > 0,
      couponCode: req.session.coupon?.code || null,
      address: latestAddress,
      paymentMethod: "Online",
      status: "Pending",
    paymentStatus: "Pending",

      razorpayOrderId: rOrder.id
    });

    await order.save();

    return res.json({
      success: true,
      razorpayOrderId: rOrder.id,
      amountInPaise: rOrder.amount,
      key: process.env.RAZORPAY_KEY_ID,
      internalOrderId: order.orderId
    });

  } catch (err) {
    console.error("Create Razorpay Error:", err);
    res.json({ success: false });
  }
};
const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      internalOrderId
    } = req.body;

    // 1️⃣ Validate params
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !internalOrderId) {
      return res.json({ success: false });
    }

    // 2️⃣ Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
if (expectedSignature !== razorpay_signature) {

  await Order.updateOne(
    { orderId: internalOrderId, paymentStatus: "Pending" },
    {
      $set: {
        paymentStatus: "Failed",
        status: "Payment Failed",
        rejectReason: "Razorpay signature mismatch"
      },
      $setOnInsert: {},
    }
  );

  await Order.updateOne(
    { orderId: internalOrderId },
    {
      $set: {
        "orderedItems.$[].status": "Payment Failed"
      }
    }
  );

  return res.json({ success: false });
}


    // 3️⃣ 🔒 ATOMIC SUCCESS UPDATE
    const result = await Order.updateOne(
      { orderId: internalOrderId, paymentStatus: "Pending" },
      {
        $set: {
          paymentStatus: "Paid",
          status: "Processing",
          razorpayPaymentId: razorpay_payment_id,
          paidAt: new Date()
        }
      }
    );

    // Already handled earlier
    if (result.matchedCount === 0) {
      return res.json({ success: true, orderId: internalOrderId });
    }

    // 4️⃣ Continue business logic ONLY ON FIRST SUCCESS
    const order = await Order.findOne({ orderId: internalOrderId });
    const userId = order.userId;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (cart && cart.items.length) {
      await Promise.all(
        cart.items.map(item =>
          Product.updateOne(
            { _id: item.productId._id, "sizeVariants.size": item.size },
            { $inc: { "sizeVariants.$.quantity": -item.quantity } }
          )
        )
      );

      await Cart.updateOne({ userId }, { $set: { items: [] } });
    }

    return res.json({ success: true, orderId: internalOrderId });

  } catch (err) {
    console.error("Verify error:", err);
    res.json({ success: false });
  }
};

const markPaymentFailed = async (req, res) => {
  try {
    const { internalOrderId, reason } = req.body;

    const order = await Order.findOne({ orderId: internalOrderId });
    if (!order) return res.json({ success: false });

    // 🔒 ABSOLUTE RULE
    if (order.paymentStatus === "Paid") {
      return res.json({ success: true, ignored: true });
    }

    if (order.paymentStatus === "Pending") {
      order.paymentStatus = "Failed";
      order.status = "Payment Failed";
      order.rejectReason = reason || "Payment failed";

      order.orderedItems.forEach(i => {
        i.status = "Payment Failed";
      });

      await order.save();
    }

    return res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
};


const retryPayment = async (req, res) => {
  try {
    const { internalOrderId } = req.body;

    if (!internalOrderId) {
      return res.json({ success: false, message: "Order id required" });
    }

    // 🔒 ATOMIC CHECK + RESET
    const order = await Order.findOneAndUpdate(
      {
        orderId: internalOrderId,
        paymentStatus: "Failed"   // ✅ only failed orders can retry
      },
      {
        $set: {
          paymentStatus: "Pending",
          status: "Pending",
          rejectReason: null,
          razorpayPaymentId: null
        }
      },
      { new: true }
    );

    if (!order) {
      return res.json({
        success: false,
        message: "Retry not allowed"
      });
    }

    // Create Razorpay order
    const amountInPaise = Math.round(order.finalAmount * 100);

    const rOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: "retry_rcpt_" + Date.now()
    });

    // Save Razorpay order id
    order.razorpayOrderId = rOrder.id;
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
  orderFailurePage,


}
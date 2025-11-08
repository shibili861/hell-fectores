const mongoose = require("mongoose");
const Product = require('../../models/productSchema');
const Order=require("../../models/ordersSchema");
const User = require("../../models/userSchema");

//  List Orders (Admin)
const listOrders = async (req, res) => {
  try {
    let { search = "", status = "", sort = "desc", page = 1, ajax = false } = req.query;

    const limit = 10;
    page = Number(page);
    const skip = (page - 1) * limit;

    const query = {};

    // ✅ Search logic (supports OrderId, user name, user email)
    if (search.trim() !== "") {
      // 1️⃣ First find matching users
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ]
      }).select("_id");

      // extract user ids
      const userIds = matchingUsers.map(u => u._id);

      // 2️⃣ Apply OR condition to order search
      query.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { userId: { $in: userIds } }
      ];
    }

    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate("userId", "name email")
      .sort({ createdOn: sort === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    // AJAX response
    if (ajax === "true") {
      return res.json({ orders, totalPages, currentPage: page });
    }

    res.render("admin/orders-list", {
      title: "Order Management",
      orders,
      search,
      status,
      sort,
      currentPage: page,
      totalPages
    });

  } catch (err) {
    console.error("❌ Error loading orders:", err);
    res.status(500).render("admin/error", { message: "Failed to load orders" });
  }
};
const viewOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .populate("userId", "name email phone")
      .populate("orderedItems.product", "productName salePrice productImage")
      .lean();

    if (!order) {
      return res.status(404).render("admin/error", { message: "Order not found" });
    }

    order.orderedItems = Array.isArray(order.orderedItems)
      ? order.orderedItems
      : [];

    res.render("admin/order-detail", { title: "Order Detail", order });
  } catch (err) {
    console.error("Error viewing order:", err);
    res.status(500).render("admin/error", { message: "Error loading order" });
  }
};


const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Out for Delivery",
      "Delivered",
      "Cancelled"
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Prevent updating if already delivered / cancelled
    if (["Delivered", "Cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify a delivered or cancelled order"
      });
    }

    const previousStatus = order.status;
    order.status = status;
    order.orderedItems.forEach(item => (item.status = status));

    // ✅ If switching to Cancelled → restore product stock
    if (status === "Cancelled" && previousStatus !== "Cancelled") {
      for (const item of order.orderedItems) {
        await Product.updateOne(// size stocked variant
          { $inc: { "sizeVariants.$.quantity": item.quantity } }  
        );
      }
    }

    await order.save();

    res.json({ success: true, message: "Order status updated successfully" });
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const approveReturn = async (req, res) => {
  const { orderId } = req.params;
  const { itemId } = req.body;

  try {
    const order = await Order.findOne({ orderId });
    const item = order.orderedItems.id(itemId);

    //  Restore stock to selected variant
    await Product.updateOne(
      { _id: item.product, "sizeVariants.size": item.size },
      { $inc: { "sizeVariants.$.quantity": item.quantity } }
    );

    item.status = "Returned";
    item.returnRequested = false;
    await order.save();

    res.redirect(`/admin/orders/${orderId}`);
  } catch (err) {
    console.error(err);
    res.redirect("back");
  }
};
const rejectReturn = async (req, res) => {
  const { orderId } = req.params;
  const { itemId } = req.body;

  try {
    const order = await Order.findOne({ orderId });
    const item = order.orderedItems.id(itemId);

    item.returnRequested = false;
    item.returnReason = null;

    await order.save();
    res.redirect(`/admin/orders/${orderId}`);
  } catch (err) {
    console.error(err);
    res.redirect("back");
  }
};
module.exports = {
  listOrders,
  viewOrder,
  updateOrderStatus,
  approveReturn,
  rejectReturn

};
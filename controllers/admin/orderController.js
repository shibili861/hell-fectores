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

  
    if (search.trim() !== "") {
      
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ]
      }).select("_id");

    
      const userIds = matchingUsers.map(u => u._id);

    
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
      totalPages,
      
    });

  } catch (err) {
    console.error("Error loading orders:", err);
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

    // Prevent updating 
    if (["Delivered", "Cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify a delivered or cancelled order"
      });
    }

    const previousStatus = order.status;
    order.status = status;
    order.orderedItems.forEach(item => (item.status = status));

    // If switching to Cancelled → restore product stock
    if (status === "Cancelled" && previousStatus !== "Cancelled") {
      for (const item of order.orderedItems) {
        await Product.updateOne(
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
  try {
    const { orderId } = req.params;
    const { itemId } = req.body;

    const order = await Order.findOne({ orderId })
      .populate("orderedItems.product");

    if (!order) return res.json({ success: false, message: "Order not found" });

    const item = order.orderedItems.id(itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });

    // prevent repeated action
    if (item.returnApproved)
      return res.json({ success: false, message: "Already approved" });

    if (item.returnRejected)
      return res.json({ success: false, message: "Already rejected" });

    // ============================
    //  RESTORE PRODUCT STOCK FIXED
    if (item.product) {
  await Product.updateOne(
    {
      _id: item.product._id,
      "sizeVariants.size": item.size
    },
    {
      $inc: {
        "sizeVariants.$.quantity": item.quantity,  
        quantity: item.quantity                   
      }
    }
  );
}

    // update item flags
    item.returnRequested = false;
    item.returnApproved = true;
    item.returnRejected = false;
    item.returnedOn = new Date();
   item.status = "Returned";


order.status = "Returned";

await order.save();


    return res.json({ success: true, message: "Return approved successfully" });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Server error while approving return" });
  }
};

// ADMIN — REJECT RETURN
const rejectReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemId, adminReason } = req.body;

    const order = await Order.findOne({ orderId }).populate("orderedItems.product");
    if (!order) return res.json({ success: false, message: "Order not found" });

    const item = order.orderedItems.id(itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });

    // prevent double-action
    if (item.returnRejected)
      return res.json({ success: false, message: "Already rejected" });

    if (item.returnApproved)
      return res.json({ success: false, message: "Already approved" });

   
    item.returnRequested = false;
    item.returnApproved = false;
    item.returnRejected = true;
    item.rejectReason = adminReason;
    item.rejectedOn = new Date();
item.status = "Return Rejected";

// Automatically update main order status
order.status = "Return Rejected";

await order.save();


    return res.json({ success: true, message: "Return rejected" });

  } catch (err) {
     console.error(" REJECT RETURN ERROR ==> ", err);
  return res.json({ success: false, message: err.message });
};}

module.exports = {
  listOrders,
  viewOrder,
  updateOrderStatus,
  approveReturn,
  rejectReturn

};
const mongoose = require("mongoose");
const Product = require('../../models/productSchema');
const Order=require("../../models/ordersSchema");
const User = require("../../models/userSchema");

const { creditWallet, debitWallet } = require("../../helpers/walletHelper");
const { FindCursor } = require("mongodb");

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
      "Cancelled",
      "Returned",
      "Return Rejected",
      "requested",
      "Payment Failed"
    ];

    // Validate status
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    // Fetch order
    const order = await Order.findOne({ orderId }).populate("orderedItems.product");
    if (!order)
      return res.status(404).json({ success: false, message: "Order not found" });


    /* -----------------------------------------------------
      BLOCK STATUS UPDATE IF PAYMENT FAILED
    ----------------------------------------------------- */

    // Block if order payment failed
    if (["Failed", "Payment Failed"].includes(order.paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Cannot update status because payment failed"
      });
    }

    // Block if ANY item payment failed
    const hasFailedItem = order.orderedItems.some(
      (item) => item.status === "Payment Failed"
    );

    if (hasFailedItem) {
      return res.status(400).json({
        success: false,
        message: "Cannot update status because payment for an item failed"
      });
    }


    /* -----------------------------------------------------
     BLOCK MODIFYING FINAL STATUSES
    ----------------------------------------------------- */
    if (["Delivered", "Cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify a delivered or cancelled order"
      });
    }


    /* -----------------------------------------------------
     UPDATE ORDER + ITEMS STATUS
    ----------------------------------------------------- */
    const previousStatus = order.status;
    order.status = status;

    // Update non-cancelled items
    order.orderedItems.forEach((item) => {
      if (item.status !== "Cancelled") {
        item.status = status;
      }
    });


    /* -----------------------------------------------------
      RESTOCK IF ORDER IS CANCELLED
    ----------------------------------------------------- */
    if (status === "Cancelled" && previousStatus !== "Cancelled") {
      for (const item of order.orderedItems) {
        if (item.status !== "Cancelled") {
          if (item.size && item.product?.hasVariants) {
            // Variant restock
            await Product.updateOne(
              { _id: item.product._id, "sizeVariants.size": item.size },
              { $inc: { "sizeVariants.$.quantity": item.quantity } }
            );
          } else {
            // Simple product restock
            await Product.updateOne(
              { _id: item.product._id },
              { $inc: { quantity: item.quantity } }
            );
          }
        }
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

    //  calculate refund amount for THIS ITEM
    const refundAmount = item.price * item.quantity; // basic: price * qty

    await order.save();

    //  credit to user's wallet
    await creditWallet(
      order.userId,
      refundAmount,
      `Refund for returned item in order ${order.orderId}`,
      order.orderId
    );

    return res.json({
      success: true,
      message: "Return approved & amount added to wallet"
    });


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
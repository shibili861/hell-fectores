
const mongoose = require("mongoose");
const Cart = require("../../models/cartSchema");
const Coupon = require("../../models/couponSchema");

const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { code } = req.body;

    if (!userId) {
      return res.json({ success: false, message: "Not authenticated" });
    }

    const coupon = await Coupon.findOne({
      code: code.trim().toUpperCase(),
      isActive: true
    });

    if (!coupon) {
      return res.json({ success: false, message: "Invalid or expired coupon" });
    }

    // Check expiry
    if (coupon.expiry < new Date()) {
      coupon.status = "expired";
      coupon.isActive = false;
      await coupon.save();

      return res.json({ success: false, message: "Coupon expired" });
    }

    // Coupon usage limit check
    if (coupon.usedCount >= coupon.maxUsage) {
      coupon.status = "expired";
      coupon.isActive = false;
      await coupon.save();

      return res.json({ success: false, message: "Coupon usage limit reached" });
    }

    // User already used this coupon?
    if (coupon.usedUsers.includes(userId)) {
      return res.json({ success: false, message: "You have already used this coupon" });
    }

    // Get cart
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart empty" });
    }

    const subtotal = cart.items.reduce((sum, i) => sum + i.totalprice, 0);

    if (subtotal < coupon.minPurchase) {
      return res.json({
        success: false,
        message: `Minimum purchase ₹${coupon.minPurchase} required`
      });
    }
        
    // Calculate discount
    let discount = 0;

    if (coupon.discountType === "percentage") {
      discount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount > 0) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    } else {
      discount = coupon.discountValue;
    }

    // Save coupon in session
    req.session.coupon = {
      code: coupon.code,
      discount
    };

    // Calculate totals
    const tax = subtotal * 0.05;
    const shipping = subtotal > 5000 ? 0 : 100;
    const newTotal = subtotal + tax + shipping - discount;


    // ---------------------------------------------------------
    //     DECREMENT COUPON STOCK & UPDATE USAGE
    // ---------------------------------------------------------

    coupon.usedCount += 1;            
    coupon.usedUsers.push(userId);    

    // Auto-expire if stock finished
    if (coupon.usedCount >= coupon.maxUsage) {
      coupon.status = "expired";
      coupon.isActive = false;
    }

    await coupon.save();
    // ---------------------------------------------------------


    return res.json({
      success: true,
      discount,
      newTotal,
      message: "Coupon applied successfully"
    });

  } catch (err) {
    console.error("Apply Coupon Error:", err);
    return res.json({ success: false, message: "Something went wrong" });
  }
};


const removeCoupon = async (req, res) => {
  try {
    req.session.coupon = null;
    return res.json({ success: true, message: "Coupon removed" });
  } catch (err) {
    console.error("Remove Coupon Error:", err);
    res.json({ success: false, message: "Something went wrong" });
  }
};

module.exports={
    removeCoupon,
    applyCoupon
}
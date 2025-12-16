
const mongoose = require('mongoose');

const Coupon=require("../../models/couponSchema");





const getCouponPage = async (req, res) => {
  try {
    let { page = 1, limit = 7, search = "" } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const query = {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } }
      ]
    };

    const totalCoupons = await Coupon.countDocuments(query);
    const totalPages = Math.ceil(totalCoupons / limit);

    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.render("admin/coupon", {
      coupons,
      currentPage: page,
      totalPages,
      search
    });

  } catch (err) {
    console.error("Coupon Page Error:", err);
    res.status(500).send("Server Error");
  }
};



const createCoupon = async (req, res) => {
  try {
 const { 
  name, code, discountType, discountValue, maxDiscount,
  minPurchase, expiry, maxUsage, visibility 
} = req.body;

if (!name || !code || !discountType || !discountValue || !expiry || !visibility || !maxUsage) {
  return res.status(400).json({ success: false, message: "All required fields must be provided" });
}

    // Check unique code
    const existingCoupon = await Coupon.findOne({ code });
    if (existingCoupon) {
      return res.status(400).json({ success: false, message: "Coupon code already exists" });
    }

    // Validate discount type
    if (!["percentage", "flat"].includes(discountType)) {
      return res.status(400).json({ success: false, message: "Invalid discount type" });
    }

    if (discountValue <= 0) {
      return res.status(400).json({ success: false, message: "Discount value must be greater than 0" });
    }

    // Percentage coupon  maxDiscount
    if (discountType === "percentage" && (maxDiscount == null || maxDiscount < 0)) {
      return res.status(400).json({ success: false, message: "maxDiscount must be provided for percentage coupons" });
    }

    //  purchase amount
    if (minPurchase < 0) {
      return res.status(400).json({ success: false, message: "Minimum purchase must be 0 or greater" });
    }

    //  expiry
    const expiryDate = new Date(expiry);
    if (expiryDate <= new Date()) {
      return res.status(400).json({ success: false, message: "Expiry date must be a future date" });
    }

 const newCoupon = new Coupon({
  name,
  code,
  discountType,
  discountValue,
  maxDiscount: discountType === "percentage" ? maxDiscount : 0,
  minPurchase,
  expiry: expiryDate,
  maxUsage,
  visibility,
  status: "active",
  usedCount: 0
});


    await newCoupon.save();

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      coupon: newCoupon
    });

  } catch (error) {
    console.error("Create Coupon Error:", error);
    res.status(500).json({ success: false, message: "Server error creating coupon" });
  }
};


const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Coupon.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    return res.json({ success: true, message: "Coupon deleted successfully" });

  } catch (error) {
    console.error("Delete Coupon Error:", error);
    res.status(500).json({ success: false, message: "Server error deleting coupon" });
  }
};

const getEditCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).send("Coupon not found");
    }

    res.json({ success: true, coupon });
  } catch (error) {
    console.error("Get Edit Coupon Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const updateCoupon = async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;

    const updated = await Coupon.findByIdAndUpdate(id, updateData, { new: true });

    if (!updated) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    return res.json({ success: true, message: "Coupon updated successfully" });

  } catch (error) {
    console.error("Update Coupon Error:", error);
    res.status(500).json({ success: false, message: "Unable to update coupon" });
  }
};


const toggleCouponStatus = async (req, res) => {
  try {
    const id = req.params.id;

    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    coupon.isActive = !coupon.isActive;

    await coupon.save();

    res.json({
      success: true,
      message: coupon.isActive ? "Coupon listed" : "Coupon unlisted",
      status: coupon.isActive
    });

  } catch (error) {
    console.error("Toggle Error:", error);
    res.status(500).json({ success: false, message: "Unable to change status" });
  }
};







module.exports = {
  createCoupon,
  deleteCoupon,
  getCouponPage,
   getEditCoupon ,
   updateCoupon,
   toggleCouponStatus


};


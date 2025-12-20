const mongoose = require('mongoose');

const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv").config();
const Address = require("../../models/addressSchema");
const path = require('path');
const fs = require('fs');
const Otp=require("../../models/otpSchema")


/* =====================================================
   Email Configuration & OTP Storage
===================================================== */

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 587,
  secure: false,
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD,
  },
});

// Store OTPs temporarily
const otpStore = new Map();

// Generate OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Clean up expired OTPs
const cleanupExpiredOtps = () => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [email, data] of otpStore.entries()) {
    if (now > data.expires) {
      otpStore.delete(email);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired OTPs`);
  }
};
const hashOtp = async (otp) => {
  return await bcrypt.hash(otp, 10);
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredOtps, 5 * 60 * 1000);

/* =====================================================
   Page Loads
===================================================== */

// Load profile page
const loadProfile = async (req, res) => {
  try {
    const userId = req.session?.userId || req.user?._id;
    if (!userId) return res.redirect("/login");

    const user = await User.findById(userId);
    if (!user) return res.redirect("/login");

    const addressDoc = await Address.findOne({ userId });
    const addresses = addressDoc ? addressDoc.address : [];

   const formattedUser = {
  ...user._doc,
  profileImage: user.profileImage || null, // ✅ ensure field always exists
  createdOn: user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Not available",
};


    res.render("user/profile", { 
      user: formattedUser, 
      addresses // Make sure this is passed to the template
    });
  } catch (error) {
    console.error("Profile page error:", error);
    res.redirect("/pagenotfound");
  }
};

/* =====================================================
   OTP Management
===================================================== */


                    //   logout
const userLogout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.log("User logout error:", err);
            return res.redirect("/profile");
        }

        res.clearCookie("user_session"); // important!
        return res.redirect("/login");
    });
};

const sendOtp = async (req, res) => {
  try {
    const { email, type } = req.body;

    if (!email) {
      return res.json({ success: false, message: "Email is required" });
    }

    // 🔥 Remove old OTPs (prevents reuse)
    await Otp.deleteMany({ email, purpose: type });

    const otp = generateOtp();

    // Store hashed OTP in MongoDB
    await Otp.create({
      email,
      otpHash: await hashOtp(otp),
      purpose: type, // "email" | "password"
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 mins
    });

    console.log(`OTP for ${email}: ${otp}`); // dev only

    const subject =
      type === "email"
        ? "Email Change Verification - ÉLÉGANCE"
        : "Password Change Verification - ÉLÉGANCE";

    const purposeText =
      type === "email" ? "email address change" : "password change";

    const mailOptions = {
      from: {
        name: "ÉLÉGANCE",
        address: process.env.NODEMAILER_EMAIL,
      },
      to: email,
      subject,
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: auto;">
          <h2 style="color:#d4af37;">Your OTP Code</h2>
          <p>You are trying to complete a ${purposeText}.</p>
          <div style="font-size:32px;font-weight:bold;background:#d4af37;color:#fff;padding:15px;text-align:center;border-radius:6px;">
            ${otp}
          </div>
          <p>This OTP is valid for 10 minutes.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.json({ success: true, message: "OTP sent successfully" });

  } catch (err) {
    console.error("Send OTP error:", err);
    return res.json({ success: false, message: "Failed to send OTP" });
  }
};

// =====================================
//  VERIFY OTP
const verifyOtp = async (req, res) => {
  try {
    const { otp, email } = req.body;

    if (!otp || !email) {
      return res.json({ success: false, message: "OTP and Email required" });
    }

    const otpRecord = await Otp.findOne({ email });

    if (!otpRecord) {
      return res.json({ success: false, message: "OTP expired or not found" });
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otpHash);

    if (!isValid) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    const otpType = otpRecord.purpose;

    // 🔥 Remove OTP immediately after success
    await Otp.deleteMany({ email });

    return res.json({
      success: true,
      message: "OTP verified successfully",
      type: otpType,
    });

  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.json({ success: false, message: "Failed to verify OTP" });
  }
};

/* =====================================================
   Profile Management
===================================================== */

// Update profile
const updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.json({ success: false, message: "User not authenticated" });
    }

    
      //  VALIDATION SECTION 
   

    // Name validation
    if (!name || !/^[A-Za-z\s]{3,}$/.test(name.trim())) {
      return res.json({
        success: false,
        message: "Name must be at least 3 letters and contain only alphabets."
      });
    }

    // Email validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.json({
        success: false,
        message: "Invalid email format."
      });
    }

    // Phone validation (optional)
    if (phone) {
      // Must start > 6 (i.e., 7/8/9) and digits only and length 7-15
      if (!/^[7-9]\d{6,14}$/.test(phone)) {
        return res.json({
          success: false,
          message: "Phone number must start with 7, 8, or 9 and be 7–15 digits long."
        });
      }
    }


    // Check if email exists
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return res.json({ success: false, message: "Email already exists" });
      }
    }

    const updateData = { name, phone };
    if (email) updateData.email = email;
 
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true
     
    });
 
    if (!updatedUser) {
      return res.json({ success: false, message: "User not found" });
    }

    if (email) req.session.userEmail = updatedUser.email;

    return res.json({
      success: true,
      message: "Profile updated successfully!",
      user: updatedUser
    });

  } catch (error) {
    console.error("Update profile error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.json({ success: false, message: messages.join(", ") });
    }

    return res.json({ success: false, message: "Failed to update profile" });
  }
};


// Update password
const updatePassword = async (req, res) => {
  try {
    const { password, currentPassword } = req.body;
    const userId = req.session.userId;

    if (!password) {
      return res.json({ success: false, message: "Password is required" });
    }

    if (password.length < 6) {
      return res.json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    // If current password is provided, verify it
    if (currentPassword) {
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        return res.json({
          success: false,
          message: "Current password is incorrect",
        });
      }
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    user.password = hashedPassword;
    await user.save();

    return res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Update password error:", error);
    return res.json({ success: false, message: "Failed to update password" });
  }
};

// RENDER PAGE
const renderAddressesPage = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect("/login");

    const addressDoc = await Address.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    }).lean();

    res.render("user/address", {
      addresses: addressDoc ? addressDoc.address : [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading addresses");
  }
};

// ADD ADDRESS (WITH DUPLICATE VALIDATIONS)
const addAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Not authenticated" });

    const newAddress = {
      addressType: req.body.addressType,
      name: req.body.name,
      city: req.body.city,
      landMark: req.body.landMark,
      state: req.body.state,
      pincode: Number(req.body.pincode),
      phone: req.body.phone,
      altphone: req.body.altphone || "",
    };

    // REQUIRED VALIDATION
    const required = ["addressType", "name", "city", "state", "pincode", "phone"];
    for (const key of required) {
      if (!newAddress[key] && newAddress[key] !== 0) {
        return res.status(400).json({
          success: false,
          message: `${key} is required`,
        });
      }
    }

    // PINCODE FORMAT CHECK
    if (!/^\d{6}$/.test(String(newAddress.pincode))) {
      return res.status(400).json({
        success: false,
        message: "Invalid pincode",
      });
    }

    const userObjId = new mongoose.Types.ObjectId(userId);
    let addressDoc = await Address.findOne({ userId: userObjId });

    // IF ADDRESS DOCUMENT EXISTS → VALIDATE DUPLICATES
    if (addressDoc) {
      const normalized = (v) => (v || "").trim().toLowerCase();

      // === 1. Duplicate Address Check ===
      const duplicateAddress = addressDoc.address.some((a) =>
        normalized(a.addressType) === normalized(newAddress.addressType) &&
        normalized(a.name) === normalized(newAddress.name) &&
        normalized(a.city) === normalized(newAddress.city) &&
        normalized(a.state) === normalized(newAddress.state) &&
        String(a.pincode) === String(newAddress.pincode) &&
        normalized(a.landMark) === normalized(newAddress.landMark) &&
        a.phone.trim() === newAddress.phone.trim()
      );

      if (duplicateAddress) {
        return res.status(400).json({
          success: false,
          message: "This address already exists",
        });
      }

      // === 2. Duplicate Phone Validation ===
      const duplicatePhone = addressDoc.address.some(
        (a) =>
          a.phone.trim() === newAddress.phone.trim() ||
          (newAddress.altphone &&
            a.phone.trim() === newAddress.altphone.trim()) ||
          (a.altphone &&
            a.altphone.trim() === newAddress.phone.trim()) ||
          (a.altphone &&
            newAddress.altphone &&
            a.altphone.trim() === newAddress.altphone.trim())
      );

      if (duplicatePhone) {
        return res.status(400).json({
          success: false,
          message: "Phone number already used in another address",
        });
      }
    }

    // SAVE ADDRESS
    if (!addressDoc) {
      addressDoc = new Address({ userId: userObjId, address: [newAddress] });
    } else {
      addressDoc.address.push(newAddress);
    }

    await addressDoc.save();
    const savedAddr = addressDoc.address[addressDoc.address.length - 1];

    return res.json({
      success: true,
      message: "Address added successfully",
      address: savedAddr,
    });
  } catch (err) {
    console.error("ERROR in addAddress:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add address: " + err.message,
    });
  }
};

// GET ADDRESSES
const getAddresses = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Not authenticated" });

    const addressDoc = await Address.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    }).lean();

    return res.json({
      success: true,
      addresses: addressDoc ? addressDoc.address : [],
    });
  } catch (err) {
    console.error("Error in getAddresses:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
    });
  }
};

// EDIT ADDRESS
const editAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;

    if (!userId)
      return res.status(401).json({ success: false, message: "Not authenticated" });

    const addressDoc = await Address.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!addressDoc)
      return res.status(404).json({ success: false, message: "No addresses found" });

    const address = addressDoc.address.id(id);
    if (!address)
      return res.status(404).json({ success: false, message: "Address not found" });

    const updates = { ...req.body };
    if (updates.pincode !== undefined) updates.pincode = Number(updates.pincode);

    Object.assign(address, updates);
    await addressDoc.save();

    return res.json({ success: true, address });
  } catch (err) {
    console.error("Error in editAddress:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// DELETE ADDRESS
const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;

    const result = await Address.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $pull: { address: { _id: id } } },
      { new: true }
    );

    return res.json({
      success: true,
      message: "Address deleted successfully",
      addresses: result.address,
    });
  } catch (err) {
    console.error("Error deleting address:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const uploadProfileImage = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not logged in' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    const imageUrl = `/uploads/profile/${req.file.filename}`;

    await User.findByIdAndUpdate(req.session.userId, { profileImage: imageUrl });

    return res.json({ success: true, imageUrl });
  } catch (err) {
    console.error('Error uploading profile image:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  loadProfile,
  sendOtp,
  verifyOtp,

  updateProfile,
  updatePassword,


//   // Address Management
     addAddress,
     getAddresses,
     renderAddressesPage,
     editAddress,
     deleteAddress,
     uploadProfileImage,
     userLogout 
    
     


};
const mongoose = require('mongoose');

const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv").config();
const Address = require("../../models/addressSchema");
const path = require('path');
const fs = require('fs');


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

// Send OTP
const sendOtp = async (req, res) => {
  try {
    const { email, type } = req.body;

    if (!email) {
      return res.json({ success: false, message: "Email is required" });
    }

    // Generate OTP
    const otp = generateOtp();

    // Store OTP with expiration (10 minutes)
    otpStore.set(email, {
      otp,
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      type,
    });

    console.log(`OTP for ${email}: ${otp}`); // For development/testing

    // Email content based on type
    const emailSubject =
      type === "email"
        ? "Email Change Verification - ÉLÉGANCE"
        : "Password Change Verification - ÉLÉGANCE";

    const emailPurpose =
      type === "email" ? "email address change" : "password change";

    // Send email
    const mailOptions = {
      from: {
        name: "ÉLÉGANCE",
        address: process.env.NODEMAILER_EMAIL,
      },
      to: email,
      subject: emailSubject,
      html: `
        <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1a1410 0%, #0a0a0a 100%); padding: 30px; text-align: center;">
            <h1 style="color: #d4af37; margin: 0; font-size: 28px; font-family: 'Georgia', serif;">ÉLÉGANCE</h1>
            <p style="color: #f4e4c1; margin: 10px 0 0 0; font-size: 14px;">Luxury Redefined</p>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">OTP Verification</h2>
            <p style="color: #666; line-height: 1.6;">
              You are attempting to change your ${emailPurpose}. Use the following OTP to verify your identity:
            </p>
            
            <div style="background: #d4af37; color: white; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; margin: 30px 0; font-family: 'Courier New', monospace;">
              ${otp}
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              <strong>Important:</strong>
              <ul style="color: #666; font-size: 14px; margin: 15px 0; padding-left: 20px;">
                <li>This OTP is valid for 10 minutes only</li>
                <li>Do not share this code with anyone</li>
                <li>If you didn't request this change, please ignore this email</li>
              </ul>
            </p>
          </div>
          
          <div style="background: #0a0a0a; padding: 20px; text-align: center;">
            <p style="color: #f4e4c1; margin: 0; font-size: 12px;">
              &copy; 2024 ÉLÉGANCE. All rights reserved.
            </p>
            <p style="color: #c4a57b; margin: 5px 0 0 0; font-size: 11px;">
              Luxury Fashion House
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`OTP email sent successfully to ${email}`);
      return res.json({ success: true, message: "OTP sent successfully" });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      // Still return success for development (OTP is logged to console)
      return res.json({
        success: true,
        message: "OTP generated successfully (check console for development)",
      });
    }
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.json({ success: false, message: "Failed to send OTP" });
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  try {
    const { otp, email } = req.body;

    if (!otp || !email) {
      return res.json({ success: false, message: "OTP and email are required" });
    }

    const storedOtpData = otpStore.get(email);

    if (!storedOtpData) {
      return res.json({ success: false, message: "OTP not found or expired" });
    }

    if (Date.now() > storedOtpData.expires) {
      otpStore.delete(email);
      return res.json({ success: false, message: "OTP expired" });
    }

    if (storedOtpData.otp !== otp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    // OTP is valid, remove it from store but keep the type for later use
    const otpType = storedOtpData.type;
    otpStore.delete(email);

    return res.json({
      success: true,
      message: "OTP verified successfully",
      type: otpType,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
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

    // Check if email is being changed and if it already exists
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return res.json({ success: false, message: "Email already exists" });
      }
    }

    const updateData = { name, phone };
    if (email) {
      updateData.email = email;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.json({ success: false, message: "User not found" });
    }

    // Update session if email was changed
    if (email) {
      req.session.userEmail = updatedUser.email;
    }

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
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

const addAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      console.log("❌ No user ID - not authenticated");
      return res.status(401).json({ 
        success: false, 
        message: "Not authenticated" 
      });
    }

    console.log("4. Looking for address document...");
    let addressDoc = await Address.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    console.log("5. Address document found:", !!addressDoc);

    // ✅ STEP 1: Build newAddress first
    const newAddress = {
      addressType: req.body.addressType,
      name: req.body.name,
      city: req.body.city,
      landMark: req.body.landMark,
      state: req.body.state,
      pincode: Number(req.body.pincode),
      phone: req.body.phone,
      altphone: req.body.altphone,
    };

    console.log("6. New address data:", newAddress);

    // ✅ STEP 2: Validate before saving
    if (Object.values(newAddress).some(v => !v && v !== 0)) {
      console.log("❌ Validation failed - missing fields");
      return res.status(400).json({ 
        success: false, 
        message: "All fields are required" 
      });
    }

    // ✅ STEP 3: Create or update the document
    if (!addressDoc) {
      console.log("7. Creating new address document");
      addressDoc = new Address({ userId, address: [newAddress] });
    } else {
      console.log("7. Adding to existing address document");
      addressDoc.address.push(newAddress);
    }

    console.log("8. Saving to database...");
    await addressDoc.save();
    console.log("✅ 9. Address saved successfully!");

    console.log("10. Sending JSON response...");
    return res.json({ 
      success: true, 
      message: "Address added successfully",
      address: newAddress 
    });

  } catch (err) {
    console.error("❌ ERROR in addAddress:", err);
    console.error("Error stack:", err.stack);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to add address: " + err.message 
    });
  }
};

const getAddresses = async (req, res) => {
  console.log("=== GET ADDRESSES CALLED ===");
  try {
    const userId = req.session.userId;
    console.log("User ID:", userId);
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Not authenticated" 
      });
    }

    const addressDoc = await Address.findOne({ userId });
    console.log("Found addresses:", addressDoc ? addressDoc.address.length : 0);
    
    res.json({ 
      success: true, 
      addresses: addressDoc ? addressDoc.address : [] 
    });
  } catch (err) {
    console.error("Error in getAddresses:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch addresses" 
    });
  }
};


// Render addresses page
const renderAddressesPage = async (req, res) => {
  try {
    const userId = req.session.userId; 
    if (!userId) return res.redirect('/login');

    const addressDoc = await Address.findOne({ userId }).lean();
    const addresses = addressDoc ? addressDoc.address : [];

    res.render("user/address", { addresses });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading addresses");
  }
};

// Edit/update address
const editAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;

    // Find the user's address document first
    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc) return res.status(404).json({ success: false, message: "No addresses found" });

    const address = addressDoc.address.id(id);
    if (!address) return res.status(404).json({ success: false, message: "Address not found" });

    Object.assign(address, req.body); // update fields
    await addressDoc.save();

    res.json({ success: true, address });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Delete address (atomic + clean)
const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    // Use MongoDB $pull for nested array deletion
    const result = await Address.findOneAndUpdate(
      { userId },
      { $pull: { address: { _id: id } } },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    res.json({
      success: true,
      message: "Address deleted successfully",
      addresses: result.address
    });
  } catch (err) {
    console.error("Error deleting address:", err);
    res.status(500).json({ success: false, message: "Server error" });
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
    
     


};
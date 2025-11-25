
const mongoose = require('mongoose');
const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv").config();
const bcrypt = require("bcrypt");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");





// Generate  OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash password securely
const securePassword = async (password) => {
  try {
    return await bcrypt.hash(password, 10);
  } catch (error) {
    console.error("Error hashing password:", error);
  }
};

// Send verification email using Nodemailer
async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify Your Account",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h3>Email Verification</h3>
          <p>Your OTP code is: <strong>${otp}</strong></p>
          <p>This OTP will expire in <b>5 minutes</b>.</p>
        </div>
      `,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

// /* =====================================================
//Page Loads
// ===================================================== */

const pagenotfound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    res.redirect("/pagenotfound");
  }
};

const loadSign = async (req, res) => {
  try {
    res.render("user/signup", { message: null });
  } catch (error) {
    console.error("Signup page error:", error);
    res.status(500).send("Server error");
  }
};

const loadHomePage = async (req, res) => {
  try {
    if (req.session.user) {
      const userData = await User.findById(req.session.user).lean();
      if (!userData) {
        req.session.destroy();
        return res.redirect("/login");
      }

      res.locals.user = userData;
      return res.render("user/home", { user: userData });
    }

    res.render("user/home");
  } catch (error) {
    console.error("Home page error:", error);
    res.status(500).send("Server error");
  }
};




/* =====================================================
   🔹 Signup + OTP Flow
===================================================== */

const signup = async (req, res) => {
  const { name, phone, email, password, confirmpassword } = req.body;

  try {
    // Validate input
    if (!name || !phone || !email || !password || !confirmpassword) {
      return res.render("user/signup", { message: "All fields are required" });
    }

    if (password !== confirmpassword) {
      return res.render("user/signup", { message: "Passwords do not match" });
    }

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("user/signup", {
        message: "User with this email already exists",
      });
    }

    // Generate and send OTP
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render("user/signup", {
        message: "Failed to send OTP. Please try again.",
      });
    }

    // Save user data in session
    const passwordHash = await securePassword(password);
    req.session.userOtp = otp;
    req.session.otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
    req.session.userData = { name, phone, email, password: passwordHash };

    console.log("OTP sent to:", email, "=>", otp);
    res.render("user/verifyotp");
  } catch (error) {
    console.error("Signup error:", error);
    res.redirect("/pagenotfound");
  }
};

// Verify OTP
const verifyotp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!req.session.userOtp || !req.session.userData) {
      return res.json({
        success: false,
        message: "Session expired, please register again.",
      });
    }

    if (Date.now() > req.session.otpExpires) {
      return res.json({ success: false, message: "OTP expired, please resend" });
    }

    if (otp == req.session.userOtp) {
      const userData = req.session.userData;

      const newUser = new User({
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        password: userData.password,
      });

      await newUser.save();
      req.session.user = newUser._id;

      
      delete req.session.userOtp;
      delete req.session.otpExpires;
      delete req.session.userData;

      return res.json({ success: true, redirectUrl: "/" });
    } else {
      return res.json({ success: false, message: "Invalid OTP, please try again" });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};

// Resend OTP
const resendotp = async (req, res) => {
  try {
    const { email } = req.session.userData || {};
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email not found in session. Please register again.",
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      req.session.userOtp = otp;
      req.session.otpExpires = Date.now() + 5 * 60 * 1000;
      console.log("Resent OTP:", otp);
      return res
        .status(200)
        .json({ success: true, message: "OTP resent successfully" });
    } else {
      return res
        .status(500)
        .json({ success: false, message: "Failed to resend OTP. Please try again." });
    }
  } catch (error) {
    console.error("Error resending OTP:", error);
    res
      .status(500)
      .json({ success: false, message: "Internal server error. Please try again." });
  }
};

/* =====================================================
   Login / Logout
===================================================== */

const loadlogin = async (req, res) => {
  try {
    if (!req.session.userId) { 
      const message = req.query.message || ""; // Get message from URL parameter
      return res.render("user/loginpage", { message: message });
    }
    res.redirect("/");
  } catch (error) {
    console.error("Login page load error:", error);
    res.redirect("/pagenotfound");
  }
};

// Handle login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ isAdmin: 0, email });

    if (!findUser) {
      return res.render("user/loginpage", { message: "User not found" });
    }
    if (findUser.isBlocked) {
      return res.render("user/loginpage", {
        message: "User is blocked by admin",
      });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      return res.render("user/loginpage", { message: "Incorrect password" });
    }

     req.session.userId = findUser._id;
    req.session.save((err) => {
      if (err) console.error(err);
      res.redirect("/");
    });
  } catch (error) {
    console.error("Login error:", error);
    res.render("user/loginpage", {
      message: "Login failed, please try again later",
    });
  }
};
// Logout - USER
const userLogout= (req, res) => {
  try {
    // Clear session data
   req.session.userId = null;
    
    // Also logout from Passport
    req.logout(function(err) {
      if (err) { 
        console.log("Passport logout error:", err);
      }
      console.log("User logged out successfully");
      res.redirect("/login");
    });
    
  } catch (error) {
    console.error("Error in user logout controller:", error);
    res.redirect("/login");
  }
};

// Load forgot password page
const loadForgotPassword = async (req, res) => {
  try {
    res.render("user/forgot-password", { message: null });
  } catch (error) {
    console.error("Forgot password page error:", error);
    res.redirect("/pagenotfound");
  }
};

// Send OTP to email
const forgotPasswordSendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.render("user/forgot-password", { message: "Email not registered" });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.render("user/forgot-password", {
        message: "Failed to send OTP. Try again later.",
      });
    }

    req.session.forgotEmail = email;
    req.session.forgotOtp = otp;
    req.session.forgotOtpExpires = Date.now() + 5 * 60 * 1000;

    console.log("Forgot Password OTP:", otp);
    res.redirect("/verify-forgot-otp");
  } catch (error) {
    console.error("Forgot password send OTP error:", error);
    res.redirect("/pagenotfound");
  }
};

// Load OTP verification page
const loadForgotOtpPage = (req, res) => {
  try {
    res.render("user/verify-forgot-otp", { message: null });
  } catch (error) {
    console.error("Forgot OTP page error:", error);
    res.redirect("/pagenotfound");
  }
};

// Verify OTP
const verifyForgotOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!req.session.forgotOtp || !req.session.forgotEmail) {
      return res.render("user/forgot-password", { message: "Session expired, try again." });
    }

    if (Date.now() > req.session.forgotOtpExpires) {
      return res.render("user/verify-forgot-otp", { message: "OTP expired, resend it." });
    }

    if (otp === req.session.forgotOtp) {
      req.session.verifiedForgotEmail = req.session.forgotEmail;
      return res.redirect("/reset-password");
    } else {
      return res.render("user/verify-forgot-otp", { message: "Invalid OTP" });
    }
  } catch (error) {
    console.error("Forgot password verify OTP error:", error);
    res.redirect("/pagenotfound");
  }
};

// Resend OTP for forgot password
const resendForgotOtp = async (req, res) => {
  try {
    const email = req.session.forgotEmail;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Session expired. Please request forgot password again.",
      });
    }

    // Generate new OTP
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Try again later.",
      });
    }

    // Save OTP in session
    req.session.forgotOtp = otp;
    req.session.otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes

    console.log("Forgot Password OTP resent:", otp);

    return res.status(200).json({ success: true, message: "OTP resent successfully" });
  } catch (error) {
    console.error("Resend forgot OTP error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Load reset password page
const loadResetPasswordPage = (req, res) => {
  try {
    if (!req.session.verifiedForgotEmail) {
      return res.redirect("/forgot-password");
    }
    res.render("user/reset-password", { message: null });
  } catch (error) {
    console.error("Reset password page error:", error);
    res.redirect("/pagenotfound");
  }
};



// Reset password
const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const email = req.session.verifiedForgotEmail;

    if (!email) {
      return res.redirect("/forgot-password");
    }

    if (password !== confirmPassword) {
      return res.render("user/reset-password", { message: "Passwords do not match" });
    }

    const hashedPassword = await securePassword(password);
    await User.updateOne({ email }, { $set: { password: hashedPassword } });

    // Clear session data
    delete req.session.forgotEmail;
    delete req.session.forgotOtp;
    delete req.session.verifiedForgotEmail;

    res.render("user/loginpage", { message: "Password reset successfully. Please log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.redirect("/pagenotfound");
  }
};







 // collection page
const loadcollectionpage = async (req, res) => {
  try {
    const userId = req.session.userId; // 👈 Use consistent key
    let userData = null;

    if (userId) {
      userData = await User.findById(userId).lean();
    }

    const categories = await Category.find({ isListed: true });

    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const query = { isBlocked: false, quantity: { $gt: 0 } };
    if (categories && categories.length > 0) {
      const categoryIds = categories.map(cat => cat._id);
      query.category = { $in: categoryIds };
    }

    const products = await Product.find(query)
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    const productsWithCategory = products.map(product => ({
      ...product,
      categoryName: product.category ? product.category.name : 'Uncategorized',
    }));

    res.render('user/collection', {
      user: userData,
      products: productsWithCategory,
      category: categories,
      totalProducts,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error('Error loading collection page:', error);
    res.status(500).send('Internal Server Error');
  }
};

/// Filter products
const filterProducts = async (req, res) => {
  try {
    const { category, search, pricerange, sort, page = 1, limit = 6 } = req.query;
    

   
    const query = { 
      isBlocked: false, 
      quantity: { $gt: 0 } 
    };

    // Category filter
    if (category && category !== "all") {
      query.category = new mongoose.Types.ObjectId(category);
    }

    // Search filter
    if (search && search.trim() !== '') {
      query.productName = { $regex: search.trim(), $options: 'i' };
    }

    // Price range filter
    if (pricerange && pricerange !== "all") {
     const priceRanges = {
    "0-1000": { $gte: 0, $lte: 1000 },
    "1000-2000": { $gte: 1000, $lte: 2000 },
    "2000-3000": { $gte: 2000, $lte: 3000 },
    "4000-50000": { $gte: 4000, $lte: 5000 },
    "50000-999999": { $gte: 5000, $lte: 99999 }
};
      
      if (priceRanges[pricerange]) {
        query.salePrice = priceRanges[pricerange];
      }
    }
    
    
    let sortOption = {};
    switch (sort) {
      case 'low-to-high':
        sortOption = { salePrice: 1 };
        break;
      case 'high-to-low':
        sortOption = { salePrice: -1 };
        break;
      case 'a-z':
        sortOption = { productName: 1 };
        break;
      case 'z-a':
        sortOption = { productName: -1 };
        break;
      case 'newest':
      default:
        sortOption = { createdAt: -1 };
    }

    const skip = (page - 1) * limit;

    // Get products 
    const products = await Product.find(query)
      .populate('category', 'name')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Add categoryName to each product
    const productsWithCategory = products.map(product => ({
      ...product,
      categoryName: product.category ? product.category.name : 'Uncategorized'
    }));

    res.json({
      success: true,
      products: productsWithCategory,
      totalProducts,
      totalPages,
      currentPage: parseInt(page)
    });

  } catch (error) {
    console.error("Error filtering products:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error" 
    });
  }
};



module.exports = {
  pagenotfound,
  loadSign,
  signup,
  verifyotp,
  resendotp,
  loadlogin,
  login,
  userLogout,
  

loadForgotPassword,
  forgotPasswordSendOtp,
  loadForgotOtpPage,
  verifyForgotOtp,
  loadResetPasswordPage,
  resetPassword,
  resendForgotOtp,



  loadHomePage,
  loadcollectionpage,
  filterProducts,


};

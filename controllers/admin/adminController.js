const User = require("../../models/userSchema");
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Page Error
const pageerror = async (req, res) => {
    res.render("admin/admin-error");
};



// Load login page
const loadlogin = (req, res) => {
  res.render("admin/login", { message: null });
};

// Handle login
const login = async (req, res) => {
  const { email, password } = req.body;
  const admin = await User.findOne({ email, isAdmin: true });

  if (!admin) {
    return res.render("admin/login", { message: "Invalid email or password" });
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    return res.render("admin/login", { message: "Invalid email or password" });
  }

 req.session.adminId = admin._id;

  res.redirect("/admin/dashboard");
};


// Dashboard
const loaddashbord = async (req, res) => {
  try {
    res.render("admin/dashboard", { admin: req.session.user });
  } catch (error) {
    console.log("Error loading dashboard:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Logout
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("Error destroying session:", err);
    }
    res.redirect("/admin/login");
  });
};




module.exports = {
    loadlogin,
    login,
    loaddashbord,
    pageerror,
    logout
};

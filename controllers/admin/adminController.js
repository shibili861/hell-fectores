const User = require("../../models/userSchema");
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Page Error
const pageerror = async (req, res) => {
    res.render("admin/admin-error");
};



// Load login page

const loadlogin = (req, res) => {
  try {
    if (req.session.adminId) {
      // Admin already logged in → prevent seeing login again
      return res.redirect("/admin/dashboard");
    }

    // Not logged in → render login page (with no-cache headers)
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    res.render("admin/login", { message: null });
  } catch (error) {
    console.error("Admin login load error:", error);
    res.redirect("/admin/page-error");
  }
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
// Logout - ADMIN
const adminLogout = (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                console.log("Admin logout error:", err);
                return res.redirect("/admin/dashboard");
            }

            res.clearCookie("admin_session"); // important!
            return res.redirect("/admin/login");
        });
    } else {
        return res.redirect("/admin/login");
    }
};




module.exports = {
    loadlogin,
    login,
    loaddashbord,
    pageerror,
    adminLogout
};

const User = require("../models/userSchema");
const Cart = require("../models/cartSchema");
const userAuth = (req, res, next) => {
  if (req.session.userId) {
    User.findById(req.session.userId)
      .then((user) => {
        if (user && !user.isBlocked) {
          next();
        } else {
          // If user is blocked, destroy their session and redirect to login
          req.session.destroy((err) => {
            if (err) {
              console.log("Session destroy error:", err);
            }
            res.redirect("/login?message=User is blocked by admin");
          });
        }
      })
      .catch((error) => {
        console.log("Error in userAuth middleware:", error);
        res.status(500).send("Internal server error");
      });
  } else {
    res.redirect("/login");
  }
};
const adminAuth = (req, res, next) => {
  if (!req.session.adminId) {
    return res.redirect("/admin/login");
  }

  User.findById(req.session.adminId)
    .then((user) => {
      if (user && user.isAdmin) {
        next();
      } else {
        res.redirect("/admin/login");
      }
    })
    .catch((error) => {
      console.log("Error in adminAuth middleware:", error);
      res.status(500).send("Internal server error");
    });
};

const checkUserStatus = async (req, res, next) => {
  if (req.session.userId) {
    const user = await User.findById(req.session.userId);
    if (user && user.isBlocked) {
      // Log out blocked user
      req.session.destroy();
      res.redirect("/login?message=User is blocked by admin");
      return;
    }
  }
  next();
};

const loadUser = async (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated() && !req.session.userId) {
    req.session.userId = req.user._id;
  }

  if (req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);
      res.locals.user = user;
    } catch (err) {
      res.locals.user = null;
    }
  } else {
    res.locals.user = null;
  }

  next();
};

// 2) Load cart count
const loadCartCount = async (req, res, next) => {
  if (req.session.userId) {
    const cart = await Cart.findOne({ userId: req.session.userId });
    res.locals.cartCount = cart ? cart.items.length : 0;
  } else {
    res.locals.cartCount = 0;
  }
  next();
};

// 3) No-cache middleware
const noCache = (req, res, next) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
};





module.exports = {
  userAuth,
  adminAuth,
   checkUserStatus,
   loadUser,
  loadCartCount,
  noCache
};

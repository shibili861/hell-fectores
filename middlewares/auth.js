const User = require("../models/userSchema");
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
module.exports = {
  userAuth,
  adminAuth,
   checkUserStatus
};

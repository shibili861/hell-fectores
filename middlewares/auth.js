const User = require("../models/userSchema");

const userAuth = (req, res, next) => {
  if (req.session.userId) {
    User.findById(req.session.userId)
      .then((user) => {
        if (user && !user.isBlocked) {
          next();
        } else {
          res.redirect("/login");
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

module.exports = {
  userAuth,
  adminAuth,
};

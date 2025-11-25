const express = require('express')
const app = express();
const path = require('path')
const env = require('dotenv').config();
const db = require('./config/db');
const session = require("express-session");
const userRouter = require("./routes/userRouter");
const passport = require("./config/passport")
const adminRouter = require("./routes/adminRouter")
const User = require("./models/userSchema"); // 
const Cart = require('./models/cartSchema');
db()

app.use(express.json());
app.use(express.urlencoded({ extended: true }))




// ADMIN SESSION
app.use(
  "/admin",
  session({
    name: "admin_session",
    secret: process.env.ADMIN_SESSION_SECRET || "adminSecret123",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
    },
  })
);
// 

// USER SESSION
app.use(
  session({
    name: "user_session",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());


app.use(async (req, res, next) => {
 if (req.isAuthenticated() && !req.session.userId) {
  req.session.userId = req.user._id;
}
// Add this check for null/undefined explicitly
if (req.session.userId && req.session.userId !== null) {
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
});
            //  for cart dotin cart button
app.use(async (req, res, next) => {
  if (req.session.userId) {
    const cart = await Cart.findOne({ userId: req.session.userId });
    res.locals.cartCount = cart ? cart.items.length : 0;
  } else {
    res.locals.cartCount = 0;
  }
  next();
});






app.use((req, res, next) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});


app.set('views', path.join(__dirname, 'views'));
app.set("view engine", "ejs")

app.use(express.static(path.join(__dirname, 'public')));

app.use("/", userRouter);
app.use("/admin", adminRouter);

app.listen(process.env.PORT, () => {
    console.log('server runnnig')
})

module.exports = app;

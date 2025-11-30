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
const { loadUser, loadCartCount, noCache } = require("./middlewares/auth");


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


app.use(loadUser);
app.use(loadCartCount);
app.use(noCache);


app.set('views', path.join(__dirname, 'views'));
app.set("view engine", "ejs")

app.use(express.static(path.join(__dirname, 'public')));

app.use("/", userRouter);
app.use("/admin", adminRouter);

app.listen(process.env.PORT, () => {
    console.log('server runnnig')
})

module.exports = app;

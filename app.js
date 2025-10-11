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
db()

app.use(express.json());
app.use(express.urlencoded({ extended: true }))

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,   
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000
    }
}));

// 
app.use(passport.initialize());
app.use(passport.session());

// 🔑 Sync Passport user into session + make available in EJS
app.use(async (req, res, next) => {
 if (req.isAuthenticated() && !req.session.userId) {
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

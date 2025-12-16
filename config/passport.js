const passport=require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User=require("../models/userSchema");
const env=require("dotenv").config();
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;

    // 1️⃣ Check if user exists by googleId
    let user = await User.findOne({ googleId: profile.id });

    // 2️⃣ If exists → return safely
    if (user) {
      if (user.isBlocked) return done(null, false, { message: "User is blocked" });
      return done(null, user);
    }

    // 3️⃣ If email already exists (normal signup), attach googleId
    const existingEmailUser = await User.findOne({ email });

    if (existingEmailUser) {
      existingEmailUser.googleId = profile.id;
      await existingEmailUser.save();
      return done(null, existingEmailUser);
    }

    // 4️⃣ Create new user
    const newUser = await User.create({
      name: profile.displayName,
      email,
      googleId: profile.id,
      isBlocked: false,
      redeemed: false,
      referralPromptShown: false
    });

    return done(null, newUser);

  } catch (error) {
    console.log("Google Auth Error:", error);
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {   
  User.findById(id)                       
    .then(user => {
      done(null, user);
    })
    .catch(err => {
      done(err, null);
    });
});


module.exports=passport;
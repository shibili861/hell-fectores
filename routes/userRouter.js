const express=require('express');
const router=express.Router();
const userController=require("../controllers/user/userController");
const passport = require('passport');
const { userAuth,checkUserStatus } = require('../middlewares/auth');
const Product = require('../models/productSchema');
const productController=require("../controllers/user/productController");
const profileController=require("../controllers/user/profileController");
const cartController = require("../controllers/user/cartController")



router.get("/pagenotfound",userController.pagenotfound)



router.get('/',checkUserStatus,userController.loadHomePage)
router.get("/signup",userController.loadSign)
router.post("/signup",userController.signup)

            //   google authentication
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      // If authentication failed (including blocked users)
      let message = 'Authentication failed';
      if (info && info.message === 'User is blocked by admin') {
        message = 'User is blocked by admin';
      }
      return res.redirect('/login?message=' + encodeURIComponent(message));
    }
    
    // Log the user in
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.redirect('/');
    });
  })(req, res, next);
});




        // otp ,login ,logout
router.post("/verifyotp",userController.verifyotp);
router.post('/resendotp',userController.resendotp)
router.get("/login",userController.loadlogin);
router.post("/login",userController.login);
router.get('/Logout',userController.logout);

// Forgot password routes
router.get("/forgot-password", userController.loadForgotPassword);
router.post("/forgot-password", userController.forgotPasswordSendOtp);
router.get("/verify-forgot-otp", userController.loadForgotOtpPage);
router.post("/verify-forgot-otp", userController.verifyForgotOtp);
router.get("/reset-password", userController.loadResetPasswordPage);
router.post("/reset-password", userController.resetPassword);
router.post("/resend-forgot-otp", userController.resendForgotOtp);






// shopping page
router.get('/collections',checkUserStatus,userController.loadcollectionpage)
router.get("/collection/filter",checkUserStatus,userController.filterProducts);

// product managemet
router.get("/productsDetailes",checkUserStatus,productController.productDetails);

// Add this temporary test route
router.post('/test-add-address', (req, res) => {
  console.log("✅ TEST ROUTE HIT!");
  console.log("Request body:", req.body);
  res.json({ success: true, message: "Test route working!" });
});
// Profile routes
router.get('/userprofile',profileController.loadProfile);
router.post('/send-otp', profileController.sendOtp);
router.post('/verify-otp', profileController.verifyOtp);
router.post('/update-profile', profileController.updateProfile);
router.post('/update-password', profileController.updatePassword);




// // Address Routes

router.get('/get-addresses',profileController.getAddresses);
router.post("/add-address", profileController.addAddress);
router.get("/addresses", profileController.renderAddressesPage);
router.post("/edit-address/:id", profileController.editAddress);
router.delete("/delete-address/:id", profileController.deleteAddress);


    router.get('/cart', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.render('user/cart', { user: req.session.user });
});

router.post('/api/cart/add', cartController.addToCart);
router.get('/api/cart', cartController.getCart);
router.delete('/api/cart/:productId', cartController.removeFromCart);
router.put('/api/cart/:productId/quantity', cartController.updateQuantity);


module.exports=router;
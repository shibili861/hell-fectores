const express=require('express');
const router=express.Router();
const userController=require("../controllers/user/userController");
const passport = require('passport');
const { userAuth,checkUserStatus } = require('../middlewares/auth');
const Product = require('../models/productSchema');
const User=require("../models/userSchema");
const Order=require("../models/ordersSchema")
const productController=require("../controllers/user/productController");
const profileController=require("../controllers/user/profileController");
const cartController = require("../controllers/user/cartController");
const checkoutController=require("../controllers/user/checkoutController");
const orderController=require("../controllers/user/orderController");
const couponController = require("../controllers/user/couponController");
const wishlistController=require("../controllers/user/wishlistController");
const walletController=require("../controllers/user/walletController");
const referralController=require("../controllers/user/referralController")
const path = require('path');
const multer = require('multer');




router.get("/pagenotfound",userController.pagenotfound)



router.get('/',checkUserStatus,userController.loadHomePage)
router.get("/signup",userController.loadSign)
router.post("/signup",userController.signup)



// POST /referral/skip
router.post("/referral/skip", async (req, res) => {
  if (!req.session.userId) return res.sendStatus(401);

  await User.findByIdAndUpdate(req.session.userId, {
    hasSeenReferralPopup: true
  });

  res.json({ success: true });
});

            //   google authentication
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      const message = info?.message || "Authentication failed";
      return res.redirect('/login?message=' + encodeURIComponent(message));
    }

    req.logIn(user, (err) => {
      if (err) return next(err);
      return res.redirect('/');
    });
  })(req, res, next);
});



        // otp ,login ,logout
router.post("/verifyotp",userController.verifyotp);
router.post('/resendotp',userController.resendotp)
router.get("/login",userController.loadlogin);
router.post("/login",userController.login);
router.get('/Logout',userController.userLogout);

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
// for related products






// Profile routes
router.get('/userprofile',profileController.loadProfile);
router.post('/send-otp', profileController.sendOtp);
router.post('/verify-otp', profileController.verifyOtp);
router.post('/update-profile', profileController.updateProfile);
router.post('/update-email', profileController.updateEmailAfterOtp);

router.post('/update-password', profileController.updatePassword);
router.post("/logout", profileController.userLogout);


                             // Profile image upload

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/profile'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user-${req.session.userId}-${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

//  Upload cropped profile image
router.post('/upload-profile-image', upload.single('profileImage'), profileController.uploadProfileImage);



// // Address Routes

router.get('/get-addresses',profileController.getAddresses);
router.post("/add-address", profileController.addAddress);
router.get("/addresses", profileController.renderAddressesPage);
router.post("/edit-address/:id", profileController.editAddress);
router.delete("/delete-address/:id", profileController.deleteAddress);
                 

                //   cart MANAGEMENT

router.get("/cart", cartController.renderCartPage);

router.post('/api/cart/add', cartController.addToCart);
router.get('/api/cart', cartController.getCart);
router.delete('/api/cart/:productId/:size', cartController.removeFromCart);

router.put('/api/cart/:productId/quantity', cartController.updateQuantity);

                        // checkout MANAGEMENT

router.get("/cart/validate", cartController.validateCartBeforeCheckout);
router.get("/checkout",checkoutController.getCheckoutPage)


                        // order Managment
          // Place order
router.post('/place-order', orderController.placeOrder);
router.get('/order-success/:orderId', orderController.orderSuccessPage);





router.get('/order-details/:id',orderController.getOrderDetailsPage);
router.get('/orders/invoice/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('orderedItems.product');

    if (!order) return res.status(404).send("Order not found");

    res.render('user/invoice', { order });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});


router.get('/my-orders', orderController.getMyOrdersPage);


          // rasorpay online payment
router.post("/create-razorpay-order", orderController.createRazorpayOrder);
router.post("/verify-razorpay-payment", orderController.verifyRazorpayPayment);
router.post("/mark-payment-failed", orderController.markPaymentFailed);
router.get("/order-failure", orderController.orderFailurePage); // page render
router.post("/retry-payment", orderController.retryPayment);  
 
 


router.post('/cancel-order', orderController.cancelOrder);
router.post('/cancel-item', orderController.cancelItem);
router.post('/return-item', orderController.requestReturn);

// coupon management
router.post("/apply-coupon", couponController.applyCoupon);
router.post("/remove-coupon", couponController.removeCoupon);

  // wishlist management

router.post("/wishlist/add",wishlistController.addToWishlist);
router.post("/wishlist/remove",wishlistController.removeFromWishlist);
router.get("/wishlist", wishlistController.getWishlistPage);
router.get("/wishlist/count", wishlistController.getWishlistCount);

              // wallet mangemnt
router.get("/wallet", walletController.getWalletPage);
                 
// referreral mangement

router.post("/referral/skip", referralController.skipReferral);
router.post("/referral/apply", referralController.applyReferralCode);


router.get("/contact",userController. loadContactPage);
router.get("/about",userController. loadAboutPage);

module.exports=router;

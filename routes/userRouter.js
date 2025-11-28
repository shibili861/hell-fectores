const express=require('express');
const router=express.Router();
const userController=require("../controllers/user/userController");
const passport = require('passport');
const { userAuth,checkUserStatus } = require('../middlewares/auth');
const Product = require('../models/productSchema');
const productController=require("../controllers/user/productController");
const profileController=require("../controllers/user/profileController");
const cartController = require("../controllers/user/cartController");
const checkoutController=require("../controllers/user/checkoutController");
const orderController=require("../controllers/user/orderController")
const path = require('path');
const multer = require('multer');


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





// Profile routes
router.get('/userprofile',profileController.loadProfile);
router.post('/send-otp', profileController.sendOtp);
router.post('/verify-otp', profileController.verifyOtp);
router.post('/update-profile', profileController.updateProfile);
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
router.get('/order-success', orderController.orderSuccessPage);
router.get('/order-details/:id',orderController.getOrderDetailsPage);
router.get('/my-orders', orderController.getMyOrdersPage);


router.post('/cancel-order', orderController.cancelOrder);
router.post('/cancel-item', orderController.cancelItem);
router.post('/return-item', orderController.requestReturn);





module.exports=router;
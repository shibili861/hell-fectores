const express=require('express');
const router=express.Router();
const userController=require("../controllers/user/userController");
const passport = require('passport');
const { userAuth } = require('../middlewares/auth');
const Product = require('../models/productSchema');
const productController=require("../controllers/user/productController")





router.get("/pagenotfound",userController.pagenotfound)

/

router.get('/',userController.loadHomePage)
router.get("/signup",userController.loadSign)
router.post("/signup",userController.signup)

            //   google authentication
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/')
})


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
router.get('/collections',userController.loadcollectionpage)
router.get("/collection/filter", userController.filterProducts);

// product managemet
router.get("/productsDetailes",userAuth,productController.productDetails)


module.exports=router;
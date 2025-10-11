const express=require('express');
const router=express.Router();
const userController=require("../controllers/user/userController");
const passport = require('passport');





router.get("/pagenotfound",userController.pagenotfound)



router.get('/',userController.loadhomepage)
router.get('/collections',userController.loadcollectionpage)
router.get("/signup",userController.loadSign)
router.post("/signup",userController.signup)


router.post("/verifyotp",userController.verifyotp);
router.post('/resendotp',userController.resendotp)

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/')
})


router.get("/login",userController.loadlogin);
router.post("/login",userController.login);
router.get('/Logout',userController.logout);















module.exports=router;
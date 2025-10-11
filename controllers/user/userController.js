
const User=require("../../models/userSchema");
const nodemailer = require('nodemailer');
const env=require("dotenv").config();
const bcrypt=require("bcrypt");

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); 
}


const pagenotfound=async (req,res)=>{
    try {
        res.render('page-404')
    } catch (error) {
        res.redirect("/pagenotfound")
    }
}




const loadSign=async(req,res)=>{
console.log('fdfdfdf')
    try {
        
         res.render('user/Signup',{message:null})
        
    } catch (error) {
        console.error('signup  page error:', error);
        res.status(500).send('Server error');
    }

}






const loadhomepage = async (req, res) => {
  try {
    console.log("Session user:", req.session.user);
    const sessionUser = req.session.user;
    if (sessionUser) {
      const userData = await User.findById(sessionUser).lean(); // ✅ use sessionUser directly
      res.locals.user = userData; // make available in EJS includes
      return res.render("user/home", { user: userData });
    }
    return res.render('user/home');
  } catch (error) {
    console.error('Home page error:', error);
    res.status(500).send('Server error');
  }
};




const loadcollectionpage=async(req,res)=>{
try {
    res.render('user/collection')
} catch (error) {
    res.status(500).send(' collection page error');
}
};

function genarateOtp(){
    return Math.floor(100000 + Math.random() * 900000);
}
 async function sendverificationemail(email,otp){
   try {
    const transporter=nodemailer.createTransport({
        service:'gmail',
        port:587,
        secure:false,
        requireTLS:true,
        auth:{
            user:process.env.NODEMAILER_EMAIL,
            pass:process.env.NODEMAILER_PASSWORD
        }

    })
    const info=await transporter.sendMail({

        from:process.env.NODEMAILER_EMAIL,
        to:email,
        subject:"verify youer accout",
        text:`youer otp is${otp}`,
        html:`<b> Youer OTP:${otp}</b>`,
    })
    return info.accepted.length>0

   } catch (error) {
    console.error("erroe sending email",error)
    return false;
    
   }

 }
    
 


const signup=async (req,res)=>{
    const{name,phone,email,password,confirmpassword}=req.body;
   
    try {


        
        if(password!==confirmpassword){
            return res.render("user/signup",{message:"password does not match"})

        }
        const findUser=await User.findOne({email});
        if(findUser){
           console.log('find user')
            
            return res.render("user/signup",{message:"user with this email already exists"})
        }
         console.log(' user')
        const otp=genarateOtp();
        const emailSent =await sendverificationemail(email,otp);
       if(!emailSent){
        return res.json("email-error")
       }
        console.log('send')
       req.session.userOtp=otp;
       req.session.userData={name,phone,email,password};
       console.log("Data before otp",req.session.userData);
       res.render("user/verifyotp");
       console.log("OTP sent",otp)
    } catch (error) {
        console.error("signup error",error);
        res.redirect("/page not found")

    }
}

const securePassword=async(password)=>{
    try {
        const passwordHash=await bcrypt.hash(password,10)
        return passwordHash;
    } catch (error) {
         console.error("Error hashing password:", error);
    }
}



const verifyotp =async(req,res)=>{
    try {
        const {otp}=req.body;
        console.log('otpp',otp);
        console.log(req.session.userOtp)
        if(otp==req.session.userOtp){
           
            const user =req.session.userData;
            console.log("userdata in otp : ", user)
            const passwordHash =await securePassword(user.password);
           const saveUserData=new User({
            name:user.name,
            email:user.email,
            phone:user.phone,
            password:passwordHash, 
           })

           console.log('before save')
           await saveUserData.save();
           req.session.user=saveUserData._id;
           delete req.session.userOtp;
           res.json({success:true,redirectUrl:"/"})

        }else{
             return res.json({ success: false, message: 'Invalid OTP, please try again' });                                                                  
        }
        
    } catch (error) {
        console.error("error verifying otp",error);
        res.status(500).json({success:false,message:"an error occured"})
    }
}


const resendotp=async (req,res)=>{
    try {
        const {email}=req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }
       const otp = generateOtp();

        req.session.userOtp=otp;

        const emailSent=await sendverificationemail(email,otp);
        if(emailSent){
            console.log("resend otp",otp);
            res.status(200).json({success:true,message:"otp resend successfully"})
        }else{
            res.status(500).json({success:false,message:"failed to resend otp plz try again"})
        }
    } catch (error) {
        console.error("error resending otp",error);
        res.status(500).json({success:false,message:"internal server error plz rty again"})
        
    }
       }


const loadlogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("user/loginpage", { message: "" });
    } else {
      res.redirect("/");
    }
  } catch (error) {
    res.redirect("/pagenotfound");
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ isAdmin: 0, email });

    if (!findUser) {
      return res.render("user/loginpage", { message: "User not found" });
    }
    if (findUser.isBlocked) {
      return res.render("user/loginpage", { message: "User is blocked by admin" });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      return res.render("user/loginpage", { message: "Incorrect password " });
    }

   req.session.user = findUser._id; // store only the ID
req.session.save(err => {
  if (err) console.log(err);
  res.redirect("/");
});

  } catch (error) {
    console.log("login error", error);
    res.render("user/loginpage", { message: "Login failed, please try again later" });
  }
};

const logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    req.session.destroy((err) => {
      if (err) {
        console.log("Session destroy error:", err);
        return res.redirect("/pagenotfound");
      }

      res.clearCookie("connect.sid");
      console.log("user destroyesd")
      return res.redirect("/login");
    });
  });
};



    
















module.exports = {
    loadhomepage,
    loadSign,
    loadcollectionpage,
    signup,
    verifyotp,
    resendotp,
    loadlogin,
    pagenotfound,
    login,
    logout
   
    
   
   

    


};

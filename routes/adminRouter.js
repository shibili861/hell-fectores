const express=require('express');
const router=express.Router();
const adminController=require("../controllers/admin/adminController");
const {userAuth,adminAuth}=require("../middlewares/auth");
const customerController=require("../controllers/admin/customerController");
const Category = require('../models/categorySchema');
const categoryController=require("../controllers/admin/categoryController")
const productController=require("../controllers/admin/productController")
const multer = require('multer');


router.get('/page-error', adminController.pageerror);
router.get("/login", adminController.loadlogin);
router.post("/login", adminController.login);

router.get("/", adminAuth, adminController.loaddashbord);             // /admin
router.get("/dashboard", adminAuth, adminController.loaddashbord);   // /admin/dashboard ✅
router.get("/logout", adminController.logout);


// customer mangment
router.get("/users",adminAuth,customerController.customerinfo);
router.get("/blockcustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockcustomer",adminAuth,customerController.customerunBlocked)

// Categorymanagment
router.get("/category",adminAuth,categoryController.Categoryinfo)
router.post("/addCategory", adminAuth, categoryController.addCategory)
router.post('/listCategory', categoryController.listCategory);
router.post('/unlistCategory', categoryController.unlistCategory);
router.get("/editcategory",adminAuth,categoryController.getEditCategory)
router.post("/editcategory/:id",adminAuth,categoryController.editCategory)
//  product management


// Configure multer for memory storage (since we're using sharp for processing)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Routes
router.get('/add-product', productController.getproductAddpage);
router.post('/add-product', upload.array('images', 10), productController.addProducts);
router.get('/allProducts',productController.getallproducts);




module.exports=router;
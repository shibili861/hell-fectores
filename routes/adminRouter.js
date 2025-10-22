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
router.get("/dashboard", adminAuth, adminController.loaddashbord);   
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


// Configure multer for memory storage 
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
router.get("/addproductbutton",productController.addProductsbutton)

// Block a product
router.patch("/block-product/:id", productController.blockProduct);

// Unblock a product
router.patch("/unblock-product/:id", productController.unblockProduct);
// deleete products
router.delete('/delete-product/:id', productController.deleteProduct);
// Edit product routes
router.get('/editproducts', productController.getEditProductPage);
router.post('/updateProduct', upload.array('newImages', 5), productController.updateProduct);
   
module.exports=router;
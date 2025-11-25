const express=require('express');
const router=express.Router();
const adminController=require("../controllers/admin/adminController");
const {userAuth,adminAuth}=require("../middlewares/auth");
const customerController=require("../controllers/admin/customerController");
const Category = require('../models/categorySchema');
const categoryController=require("../controllers/admin/categoryController")
const productController=require("../controllers/admin/productController");
const orderController=require("../controllers/admin/orderController")
const multer = require('multer');


router.get('/page-error', adminController.pageerror);
router.get("/login", adminController.loadlogin);
router.post("/login", adminController.login);

router.get("/", adminAuth, adminController.loaddashbord);             // /admin
router.get("/dashboard", adminAuth, adminController.loaddashbord);   
router.get("/logout", adminController.adminLogout);


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
router.post("/deleteCategory", adminAuth, categoryController.deleteCategory)
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

// adding products and managing
router.get('/add-product', productController.getproductAddpage);
router.post('/add-product', upload.array('images', 10), productController.addProducts);
router.get('/allProducts',productController.getallproducts);
router.get("/addproductbutton",productController.addProductsbutton)
router.patch("/block-product/:id", productController.blockProduct);
router.patch("/unblock-product/:id", productController.unblockProduct);
router.delete('/delete-product/:id', productController.deleteProduct);
router.get('/editproducts', productController.getEditProductPage);
router.post('/updateProduct', upload.array('newImages', 5), productController.updateProduct);
   


        // ordeer Management
 router.get("/orders", adminAuth,orderController.listOrders);
 
router.get("/orders/:orderId", adminAuth,orderController.viewOrder);

// New route to change status
router.post("/orders/:orderId/status", adminAuth,orderController.updateOrderStatus);
router.post("/orders/:orderId/approve-return", adminAuth, orderController.approveReturn);
router.post("/orders/:orderId/reject-return", adminAuth, orderController.rejectReturn);


module.exports=router;
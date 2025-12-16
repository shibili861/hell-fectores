const express=require('express');
const router=express.Router();
const adminController=require("../controllers/admin/adminController");
const {userAuth,adminAuth}=require("../middlewares/auth");
const customerController=require("../controllers/admin/customerController");
const Category = require('../models/categorySchema');
const categoryController=require("../controllers/admin/categoryController")
const productController=require("../controllers/admin/productController");
const orderController=require("../controllers/admin/orderController");
const couponController=require("../controllers/admin/couponController");
const salesReportController = require("../controllers/admin/salesReportController");
const wallet=require("../models/walletSchema");


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



        //    coupon management
router.get("/coupon", couponController.getCouponPage);
router.post("/coupon/create", couponController.createCoupon);
router.delete("/coupon/delete/:id", couponController.deleteCoupon);

// Edit coupon
router.get("/coupon/edit/:id", couponController.getEditCoupon);
router.post("/coupon/edit/:id", couponController.updateCoupon);

// Toggle list / unlist
router.post("/coupon/toggle/:id", couponController.toggleCouponStatus);

                            // offer mangement  in products
 router.post("/products/offer/:id",  productController.addOffer);
router.post("/products/remove-offer/:id", productController.removeOffer);

                            // offer mangement in category
 router.post("/category/:id/offer", categoryController.setCategoryOffer);
router.post("/category/:id/offer/remove", categoryController.removeCategoryOffer);



// SALES REPORT API 
router.get("/sales-report/data", adminAuth, salesReportController.getReportData);

// Download endpoints
router.get("/sales-report/download/pdf", adminAuth, salesReportController.downloadPDF);
router.get("/sales-report/download/excel", adminAuth, salesReportController.downloadExcel);

module.exports=router;
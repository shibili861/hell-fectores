const mongoose = require("mongoose");
const Product = require('../../models/productSchema');
const Category = require("../../models/categorySchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const getproductAddpage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
       
        res.render("admin/products-add", {
            cat: category
        });
    } catch (error) {
        console.error('Error in getproductAddpage:', error);
        res.redirect("/admin-error");
    }
};
const addProducts = async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            
            return res.json({
                success: false,
                message: "Database connection failed. Please check if MongoDB is running."
            });
        }
         console.log('=== BACKEND RECEIVED DATA ===');
        console.log('req.body.sizes:', req.body.sizes);
        console.log('req.body.quantities:', req.body.quantities);
        console.log('req.body.enableVariants:', req.body.enableVariants);
         
        const { productName, category, regularPrice, salePrice, stockQty, description, shortDescription, sizes, quantities } = req.body;

        if (!productName || !category || !regularPrice || !stockQty || !description) {
            return res.json({
                success: false,
                message: "All required fields must be filled"
            });
        }

        const productExists = await Product.findOne({ productName });
        if (productExists) {
            return res.json({
                success: false,
                message: "Product with this name already exists"
            });
        }

        const categoryDoc = await Category.findOne({ name: category });
        if (!categoryDoc) {
            return res.json({
                success: false,
                message: "Invalid category selected"
            });
        }

        // Handle image uploads
        const productImage = [];
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const filename = 'product-' + uniqueSuffix + '.jpg';
                
                const uploadDir = path.join(__dirname, '../../public/uploads/products');
                const filePath = path.join(uploadDir, filename);
                
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                await sharp(file.buffer)
                    .resize(800, 800, { fit: 'cover', withoutEnlargement: true })
                    .jpeg({ quality: 85 })
                    .toFile(filePath);

                productImage.push('/uploads/products/' + filename);
            }
        }

        if (productImage.length === 0) {
            return res.json({
                success: false,
                message: "At least one product image is required"
            });
        }

        let status = parseInt(stockQty) === 0 ? 'Out of stock' : 'Available';

        // Handle size variants (only sizes and quantities)
        const sizeVariants = [];
        let hasVariants = false;
        
        if (sizes && Array.isArray(sizes)) {
            for (let i = 0; i < sizes.length; i++) {
                if (sizes[i] && quantities[i]) {
                    sizeVariants.push({
                        size: sizes[i],
                        quantity: parseInt(quantities[i]) || 0
                    });
                }
            }
            hasVariants = sizeVariants.length > 0;
        }

        // Calculate total quantity from variants if they exist
        let totalQuantity = parseInt(stockQty);
        if (hasVariants) {
            totalQuantity = sizeVariants.reduce((total, variant) => total + variant.quantity, 0);
            status = totalQuantity === 0 ? 'Out of stock' : 'Available';
        }

        const newProduct = new Product({
            productName,
            description,
            shortDescription: shortDescription || '',
            category: categoryDoc._id,
            regularPrice: parseFloat(regularPrice),
            salePrice: salePrice ? parseFloat(salePrice) : 0,
            quantity: totalQuantity,
            productImage,
            status,
            sizeVariants,
            hasVariants
        });
   console.log("user saved")
        await newProduct.save();

        return res.json({
            success: true,
            message: "Product added successfully!",
            redirectUrl: "/admin/add-product"
        });

    } catch (error) {
        console.error('Error in addProducts:', error);
        return res.json({
            success: false,
            message: "Internal server error: " + error.message
        });
    }
};

// button add products
const addProductsbutton = async (req, res) => {
    try {
        // Fetch categories from database
        const categories = await Category.find({ isListed: true });
        
        console.log('Categories found:', categories.length); 
        
        res.render("admin/products-add", { 
            cat: categories  
        });
    } catch (error) {
        console.error("Error loading add products page:", error);
        res.redirect("/admin-error");
    }
};


const getallproducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
       
        let searchQuery = {};
        if (search && search.trim() !== "") {
            searchQuery = {
                $or: [
                    { productName: { $regex: new RegExp(".*" + search + ".*", "i") } }
                ]
            };
        }

        // Get products with pagination
        const productData = await Product.find(searchQuery)
            .limit(limit)
            .skip((page - 1) * limit)
            .populate('category')
            .exec();

       
        const count = await Product.countDocuments(searchQuery);
        
        const category = await Category.find({ isListed: true });
        
        if (category) {
            res.render("admin/allproducts", {
                data: productData,
                count: count,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                cat: category,
                search: search
            });
        } else {
            res.status(404).render("page-not-found");
        }

    } catch (error) {
        console.error('Error in getallproducts:', error);
        res.redirect("/admin-error");
    }
};

// --- BLOCK PRODUCT ---
const blockProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    product.isBlocked = true; // 
    await product.save();

    res.json({ success: true, message: "Product blocked successfully" });
  } catch (error) {
    console.error("Error blocking product:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// --- UNBLOCK PRODUCT ---
const unblockProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    product.isBlocked = false; 
    await product.save();

    res.json({ success: true, message: "Product unblocked successfully" });
  } catch (error) {
    console.error("Error unblocking product:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

     
const deleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;
      
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Delete product images from file system
        if (product.productImage && product.productImage.length > 0) {
            for (const imagePath of product.productImage) {
             
                const fullPath = path.join(__dirname, '../../public', imagePath);
                
                
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            }
        }

       
        await Product.findByIdAndDelete(productId);
        
        res.json({ success: true, message: "Product deleted successfully" });
        
    } catch (error) {
        console.error("Error in deleting product:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};


// edit products
const getEditProductPage = async (req, res) => {
    try {
        const productId = req.query.id;
        
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.redirect("/admin/allproducts");
        }

        const product = await Product.findById(productId).populate('category');
        const categories = await Category.find({ isListed: true });

        if (!product) {
            return res.redirect("/admin/allproducts");
        }
        
        if (!product.hasVariants) product.hasVariants = false;
        if (!product.sizeVariants) product.sizeVariants = [];
        
        res.render("admin/editproducts", {
            product: product,
            cat: categories
        });

    } catch (error) {
        console.error('Error in getEditProductPage:', error);
        res.redirect("/admin-error");
    }
};
// --- UPDATE PRODUCT ---
const updateProduct = async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({
                success: false,
                message: "Database connection failed. Please check if MongoDB is running."
            });
        }

        const productId = req.body.productId;
        const { 
            productName, 
            category, 
            regularPrice, 
            salePrice, 
            stockQty, 
            description, 
            shortDescription,
            sizes,
            quantities,
            enableVariants
        } = req.body;

        // Validate required fields
        if (!productName || !category || !regularPrice || !stockQty || !description) {
            return res.json({
                success: false,
                message: "All required fields must be filled"
            });
        }

        // Check if product exists
        const existingProduct = await Product.findById(productId);
        if (!existingProduct) {
            return res.json({
                success: false,
                message: "Product not found"
            });
        }

       
        const duplicateProduct = await Product.findOne({
            productName: productName,
            _id: { $ne: productId }
        });

        if (duplicateProduct) {
            return res.json({
                success: false,
                message: "Another product with this name already exists"
            });
        }

        // Validate category
        const categoryDoc = await Category.findById(category);
        if (!categoryDoc) {
            return res.json({
                success: false,
                message: "Invalid category selected"
            });
        }

        // Handle removed images
        let updatedImages = [...existingProduct.productImage];
        if (req.body.removedImages) {
            try {
                const removedImages = JSON.parse(req.body.removedImages);
                
                for (const imageIndex of removedImages) {
                    if (updatedImages[imageIndex]) {
                        // Delete image file 
                        const imagePath = path.join(__dirname, '../../public', updatedImages[imageIndex]);
                        if (fs.existsSync(imagePath)) {
                            fs.unlinkSync(imagePath);
                        }
                        // Remove from array
                        updatedImages[imageIndex] = null;
                    }
                }
                // Filter out null values
                updatedImages = updatedImages.filter(img => img !== null);
            } catch (error) {
                console.error('Error parsing removedImages:', error);
            }
        }

        // Handle new image uploads
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const filename = 'product-' + uniqueSuffix + '.jpg';
                
                const uploadDir = path.join(__dirname, '../../public/uploads/products');
                const filePath = path.join(uploadDir, filename);
                
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                await sharp(file.buffer)
                    .resize(800, 800, {
                        fit: 'cover',
                        withoutEnlargement: true
                    })
                    .jpeg({ quality: 85 })
                    .toFile(filePath);

                updatedImages.push('/uploads/products/' + filename);
            }
        }

        // Handle size variants (only sizes and quantities)
        const sizeVariants = [];
        let hasVariants = false;
        let totalQuantity = parseInt(stockQty);

        if (enableVariants && sizes && Array.isArray(sizes)) {
            for (let i = 0; i < sizes.length; i++) {
                if (sizes[i] && quantities[i] !== undefined && quantities[i] !== '') {
                    sizeVariants.push({
                        size: sizes[i],
                        quantity: parseInt(quantities[i]) || 0
                    });
                }
            }
            hasVariants = sizeVariants.length > 0;
            
            // Calculate total quantity from variants
            if (hasVariants) {
                totalQuantity = sizeVariants.reduce((total, variant) => total + variant.quantity, 0);
            }
        }

        // Update status based on stock quantity
        let status = 'Available';
        if (totalQuantity === 0) {
            status = 'Out of stock';
        }

        // Update product
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
                productName: productName,
                description: description,
                shortDescription: shortDescription || '',
                category: category,
                regularPrice: parseFloat(regularPrice),
                salePrice: salePrice ? parseFloat(salePrice) : 0,
                quantity: totalQuantity,
                productImage: updatedImages,
                status: status,
                sizeVariants: sizeVariants,
                hasVariants: hasVariants,
                updatedAt: Date.now()
            },
            { new: true }
        ).populate('category');

        if (!updatedProduct) {
            return res.json({
                success: false,
                message: "Failed to update product"
            });
        }

        return res.json({
            success: true,
            message: "Product updated successfully!",
            redirectUrl: "/admin/allproducts"
        });

    } catch (error) {
        console.error('Error in updateProduct:', error);
        
        return res.json({
            success: false,
            message: "Internal server error: " + error.message
        });
    }
};




module.exports = {
    getproductAddpage,
    addProducts,
    getallproducts,
    blockProduct,
    unblockProduct,
    deleteProduct,
     getEditProductPage,
    updateProduct,
    addProductsbutton

};











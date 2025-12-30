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
        // Ensure DB connection is active
        if (mongoose.connection.readyState !== 1) {
            return res.json({
                success: false,
                message: "Database connection failed. Please check if MongoDB is running."
            });
        }

        // Extract body data
        const { 
            productName, 
            category, 
            regularPrice, 
            stockQty, 
            description, 
            shortDescription, 
            sizes, 
            quantities,
            productOffer
        } = req.body;

        // Validate required fields
        if (!productName || !category || !regularPrice || !stockQty || !description) {
            return res.json({
                success: false,
                message: "All required fields must be filled"
            });
        }

        // Validate regular price
        const parsedRegularPrice = parseFloat(regularPrice);
        if (isNaN(parsedRegularPrice) || parsedRegularPrice < 0) {
            return res.json({
                success: false,
                message: "Regular price must be a positive number"
            });
        }

        // Parse and validate product offer
        let parsedOffer = Number(productOffer) || 0;
        if (parsedOffer < 0 || parsedOffer > 100) {
            return res.json({
                success: false,
                message: "Product offer must be between 0 and 100"
            });
        }

        // Check for duplicate product name
        const productExists = await Product.findOne({ productName });
        if (productExists) {
            return res.json({
                success: false,
                message: "Product with this name already exists"
            });
        }

        // Validate category
        const categoryDoc = await Category.findOne({ name: category });
        if (!categoryDoc) {
            return res.json({
                success: false,
                message: "Invalid category selected"
            });
        }

        // Process images
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

        // Handle size variants
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

        // Calculate total quantity (with or without variants)
        let totalQuantity = parseInt(stockQty);
        let status = totalQuantity === 0 ? "Out of stock" : "Available";

        if (hasVariants) {
            totalQuantity = sizeVariants.reduce((total, variant) => total + variant.quantity, 0);
            status = totalQuantity === 0 ? "Out of stock" : "Available";
        }

        // Create new product
        const newProduct = new Product({
            productName,
            description,
            shortDescription: shortDescription || "",
            category: categoryDoc._id,
            regularPrice: parsedRegularPrice,
            productOffer: parsedOffer, // category offer applied automatically later
            quantity: totalQuantity,
            productImage,
            status,
            sizeVariants,
            hasVariants
        });

        // Model will auto-calc salePrice using applyBestOffer()
        await newProduct.save();

        return res.json({
            success: true,
            message: "Product added successfully!",
            redirectUrl: "/admin/add-product"
        });

    } catch (error) {
        console.error("Error in addProducts:", error);
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
    const category = req.query.category || "";
    const status = req.query.status || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 8;

    let query = {};

    //  Search filter
    if (search.trim()) {
      query.productName = { $regex: search, $options: "i" };
    }

    //  Category filter
    if (category) {
      query.category = category;
    }

    //  Status filter
    if (status === "active") {
      query.isBlocked = false;
    } else if (status === "blocked") {
      query.isBlocked = true;
    }

    const productData = await Product.find(query)
      .populate("category")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const count = await Product.countDocuments(query);
    const categories = await Category.find({ isListed: true });

    res.render("admin/allproducts", {
      data: productData,
      count,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      cat: categories,
      search,
      selectedCategory: category,
      status
    });

  } catch (error) {
    console.error("Error in getallproducts:", error);
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
            stockQty, 
            description, 
            shortDescription,
            sizes,
            quantities,
            enableVariants,
            productOffer
        } = req.body;

        // Validate required fields
        if (!productName || !category || !regularPrice || !stockQty || !description) {
            return res.json({
                success: false,
                message: "All required fields must be filled"
            });
        }

        // Validate regular price
        const parsedRegularPrice = parseFloat(regularPrice);
        if (isNaN(parsedRegularPrice) || parsedRegularPrice < 0) {
            return res.json({
                success: false,
                message: "Regular price must be a positive number"
            });
        }

        // Validate product offer
        let parsedOffer = Number(productOffer) || 0;
        if (parsedOffer < 0 || parsedOffer > 100) {
            return res.json({
                success: false,
                message: "Product offer must be between 0 and 100"
            });
        }

        // Ensure product exists
        const existingProduct = await Product.findById(productId);
        if (!existingProduct) {
            return res.json({
                success: false,
                message: "Product not found"
            });
        }

        // Duplicate name check
        const duplicateProduct = await Product.findOne({
            productName,
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

        // -----------------------
        // HANDLE IMAGES
        // -----------------------
        let updatedImages = [...existingProduct.productImage];

        if (req.body.removedImages) {
            const removed = JSON.parse(req.body.removedImages);
            for (const index of removed) {
                if (updatedImages[index]) {
                    const filePath = path.join(__dirname, "../../public", updatedImages[index]);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    updatedImages[index] = null;
                }
            }
            updatedImages = updatedImages.filter(img => img !== null);
        }

        if (req.files && req.files.length > 0) {
            for (let file of req.files) {
                const filename = `product-${Date.now()}-${Math.random()}.jpg`;

                const uploadDir = path.join(__dirname, "../../public/uploads/products");
                const filePath = path.join(uploadDir, filename);

                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                await sharp(file.buffer)
                    .resize(800, 800, { fit: "cover", withoutEnlargement: true })
                    .jpeg({ quality: 85 })
                    .toFile(filePath);

                updatedImages.push(`/uploads/products/${filename}`);
            }
        }

        // -----------------------
        // HANDLE SIZE VARIANTS
        // -----------------------
        const sizeVariants = [];
        let hasVariants = false;
        let totalQuantity = parseInt(stockQty);

        if (enableVariants && sizes && Array.isArray(sizes)) {
            for (let i = 0; i < sizes.length; i++) {
                if (sizes[i] && quantities[i] !== "") {
                    sizeVariants.push({
                        size: sizes[i],
                        quantity: parseInt(quantities[i]) || 0
                    });
                }
            }

            hasVariants = sizeVariants.length > 0;

            if (hasVariants) {
                totalQuantity = sizeVariants.reduce((acc, v) => acc + v.quantity, 0);
            }
        }

        let status = totalQuantity === 0 ? "Out of stock" : "Available";

        // -----------------------
        // UPDATE PRODUCT 
        // -----------------------
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
                productName,
                description,
                shortDescription: shortDescription || "",
                category,
                regularPrice: parsedRegularPrice,
                productOffer: parsedOffer,
                productImage: updatedImages,
                status,
                sizeVariants,
                hasVariants,
                quantity: totalQuantity,
                updatedAt: Date.now()
            },
            { new: true }
        );

        if (!updatedProduct) {
            return res.json({
                success: false,
                message: "Failed to update product"
            });
        }

        // -----------------------
        // APPLY BEST OFFER LOGIC
        // -----------------------
        await updatedProduct.applyBestOffer();
        await updatedProduct.save();

        return res.json({
            success: true,
            message: "Product updated successfully!",
            redirectUrl: "/admin/allproducts"
        });

    } catch (error) {
        console.error("Error in updateProduct:", error);
        return res.json({
            success: false,
            message: "Internal server error: " + error.message
        });
    }
};

const addOffer = async (req, res) => {
    try {
        const { offer } = req.body;
        const id = req.params.id;

        if (offer < 0 || offer > 89) {
            return res.json({ success: false, message: "Offer must be 0–89%" });
        }

        const product = await Product.findById(id);
        product.productOffer = offer;
      await product.applyBestOffer();

        await product.save();

        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, message: "Error applying offer" });
    }
};

const removeOffer = async (req, res) => {
    try {
        const id = req.params.id;

        const product = await Product.findById(id);
        product.productOffer = 0;
      await product.applyBestOffer();
        await product.save();
        

        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, message: "Error removing offer" });
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
    addProductsbutton,
    addOffer,
    removeOffer

};











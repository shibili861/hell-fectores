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

        const { productName, category, regularPrice, salePrice, stockQty, description, shortDescription } = req.body;
        
        if (!productName || !category || !regularPrice || !stockQty || !description) {
            return res.json({
                success: false,
                message: "All required fields must be filled"
            });
        }

        const productExists = await Product.findOne({
            productName: productName
        });

        if (productExists) {
            return res.json({
                success: false,
                message: "Product with this name already exists"
            });
        }

        // Fix: Changed variable name from findcategoryDoc to categoryDoc for consistency
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
                    .resize(800, 800, {
                        fit: 'cover',
                        withoutEnlargement: true
                    })
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

        let status = 'Available';
        if (parseInt(stockQty) === 0) {
            status = 'Out of stock';
        }

        // Create new product
        const newProduct = new Product({
            productName: productName,
            description: description,
            shortDescription: shortDescription || '',
            category: categoryDoc._id, // Now using the correct variable
            regularPrice: parseFloat(regularPrice),
            salePrice: salePrice ? parseFloat(salePrice) : 0,
            quantity: parseInt(stockQty),
            productImage: productImage,
            status: status
        });

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





const getallproducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
       
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

module.exports = {
    getproductAddpage,
    addProducts,
    getallproducts
};
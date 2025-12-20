const Product=require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const User=require("../../models/userSchema");








const productDetails = async (req, res) => {
    try {
        const userId = req.session.userId;
        const userData = await User.findById(userId);

        const productId = req.query.id;

        // Fetch current product
        const product = await Product
            .findById(productId)
            .populate("category");

        if (!product) {
            return res.redirect("/pagenotfound");
        }

        // Fetch max 3 related products from same category
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id } // exclude current product
        })
        .limit(3);

        res.render("user/productsDetailpage", {
            user: userData,
            product: product,
            quantity: product.quantity,
            category: product.category,
            relatedProducts // 👈 send to EJS
        });

    } catch (error) {
        console.error("Error fetching product details:", error);
        res.redirect("/pagenotfound");
    }
};





module.exports={
    productDetails

}




const Product=require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const User=require("../../models/userSchema");









const productDetails = async (req, res) => {
    try {
            
        const userId = req.session.userId;
        const userData = await User.findById(userId);
        const productId = req.query.id;
        const product = await Product.findById(productId).populate("category");
        const findCategory = product.category;
      
        res.render("user/productsDetailpage", {
            user: userData,
            product: product,
            quantity: product.quantity,
            category: findCategory,
             

        });
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.redirect("/pagenotfound");
    }
};




module.exports={
    productDetails

}




const mongoose = require("mongoose");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");







const renderCartPage=async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = userId ? await User.findById(userId) : null;

    
    const cart = userId ? await Cart.findOne({ userId }) : null;
    const cartCount = cart ? cart.items.length : 0;

    // Render EJS and pass user + cart count
    res.render("user/cart", { user, cartCount });
  } catch (err) {
    console.error("Render cart error:", err);
    res.render("user/cart", { user: null, cartCount: 0 });
  }
};

const addToCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId, quantity = 1, size } = req.body;

    if (!userId)
      return res.status(401).json({ success: false, message: "Not authenticated" });

    const product = await Product.findById(productId).populate("category");
    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    if (product.isBlocked || product.status !== "Available")
      return res.status(400).json({ success: false, message: "Product unavailable" });

    if (!product.category.isListed)
      return res.status(400).json({ success: false, message: "Category unlisted" });

    // Check size requirement
    if (product.sizes && product.sizes.length > 0 && !size) {
      return res.status(400).json({ success: false, message: "Please select a size" });
    }

    let availableStock = product.stock; 

  
    if (product.sizes && product.sizes.length > 0) {
      const sizeObj = product.sizes.find(s => s.size === size);
      if (!sizeObj)
        return res.status(400).json({ success: false, message: "Invalid size selected" });

      availableStock = sizeObj.stock; // Stock of selected size
    }

    let cart = await Cart.findOne({ userId });
    const unitPrice = product.salePrice || product.regularPrice;

    // If cart does NOT exist
    if (!cart) {
      // check initial quantity > available stock
      if (quantity > availableStock) {
        return res.status(400).json({
          success: false,
          message: `Only ${availableStock} items available`,
        });
      }

      cart = new Cart({
        userId,
        items: [
          {
            productId,
            quantity,
            price: unitPrice,
            totalprice: unitPrice * quantity,
            ...(size && { size }),
          },
        ],
      });
    } else {
      // cart exists → check if same item already exists
      const item = cart.items.find(
        (i) =>
          i.productId.equals(productId) &&
          (!size || i.size === size)
      );

      if (item) {
        const newQty = item.quantity + quantity;

        // MAX 3 PER PRODUCT
        if (newQty > 3) {
          return res.status(400).json({
            success: false,
            message: "Maximum 3 items allowed per product",
          });
        }

        // 3️ CHECK STOCK BEFORE INCREASE
        if (newQty > availableStock) {
          return res.status(400).json({
            success: false,
            message: `Only ${availableStock} items available`,
          });
        }

        item.quantity = newQty;
        item.totalprice = unitPrice * newQty;
      } else {
        // New item to cart
        if (quantity > availableStock) {
          return res.status(400).json({
            success: false,
            message: `Only ${availableStock} items available`,
          });
        }

        cart.items.push({
          productId,
          quantity,
          price: unitPrice,
          totalprice: unitPrice * quantity,
          ...(size && { size }),
        });
      }
    }

    await cart.save();

    return res.json({
      success: true,
      message: size
        ? `Added size ${size} to cart`
        : "Added to cart",
      cart,
    });

  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

//  Get Cart with User Data
const getCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });
    
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const user = await User.findById(userId).select('name email'); // Get user details
    
    console.log("Cart fetched for user:", userId);
    console.log("Session userId:", req.session.userId);
    console.log("Cart data:", JSON.stringify(cart, null, 2));
    
    res.json({ 
      success: true, 
      cart: cart || { items: [] },
      user: user || null 
    });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({ success: false, message: "Error fetching cart" });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId, size } = req.params;  

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.json({ success: true, cart: { items: [] } });

    //  Filter out only the matching product + size
    cart.items = cart.items.filter(
      (i) => !(i.productId.equals(productId) && i.size === size)
    );

    await cart.save();

    res.json({ success: true, message: "Item removed", cart });
  } catch (err) {
    console.error("Error removing item:", err);
    res.status(500).json({ success: false, message: "Error removing item" });
  }
};


// Update Quantity
const updateQuantity = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId } = req.params;
    const { quantityDelta } = req.body;

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    const item = cart.items.find(i => i.productId.equals(productId));
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    const newQty = item.quantity + Number(quantityDelta);
    if (newQty < 1) return res.json({ success: false, message: "Min quantity is 1" });
    if (newQty > 3) return res.json({ success: false, message: "Max 3 items allowed" });

    const product = await Product.findById(productId);
    const unitPrice = product.salePrice || product.regularPrice;

    item.quantity = newQty;
    item.price = unitPrice;
    item.totalprice = unitPrice * newQty;
    await cart.save();

    res.json({ success: true, message: "Quantity updated", updatedItem: item, cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const validateCartBeforeCheckout = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.json({ success: false, message: "Login required" });

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0)
      return res.json({ success: false, message: "Cart is empty" });

    const invalidItems = [];

    cart.items.forEach((item) => {
      const product = item.productId;

      // Product check
      if (!product || product.isBlocked || product.status === "Discontinued") {
        invalidItems.push({
          name: product?.productName || "Removed Product",
          reason: "Product unavailable",
        });
        return;
      }

      //  Size variant stock check (if applicable)
      if (product.hasVariants && item.size) {
        const variant = product.sizeVariants.find((v) => v.size === item.size);

        if (!variant || variant.quantity < item.quantity) {
          invalidItems.push({
            name: product.productName,
            reason: `Only ${variant?.quantity || 0} left for size ${item.size}`,
          });
        }
      } else {
        //  Normal quantity check
        if (product.quantity < item.quantity) {
          invalidItems.push({
            name: product.productName,
            reason: `Only ${product.quantity} left in stock`,
          });
        }
      }
    });

    if (invalidItems.length > 0) {
      return res.json({
        success: false,
        invalidItems,
        message: "Some items in cart are unavailable",
      });
    }

    return res.json({ success: true }); 
  } catch (error) {
    console.error("Cart validation error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports={
    addToCart,
    getCart,
    removeFromCart,
    updateQuantity,
    renderCartPage,
     validateCartBeforeCheckout



}
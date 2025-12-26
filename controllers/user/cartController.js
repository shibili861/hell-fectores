const mongoose = require("mongoose");
const Wishlist = require("../../models/wishlistSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");



function calculateTotals(cart) {
  let subtotal = 0;

  cart.items.forEach(item => {
    subtotal += item.totalprice;
  });

  // ⭐ NEW RULE: Free shipping above ₹2000
  let shipping = subtotal >= 2000 ? 0 : 49;

  const total = subtotal + shipping;

  cart.subtotal = subtotal;
  cart.shipping = shipping;
  cart.total = total;

  return { subtotal, shipping, total };
}



// ================= RENDER CART PAGE ====================
const renderCartPage = async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = userId ? await User.findById(userId) : null;

    const cart = userId ? await Cart.findOne({ userId }) : null;
    const cartCount = cart ? cart.items.length : 0;

    res.render("user/cart", { user, cartCount });
  } catch (err) {
    console.error("Render cart error:", err);
    res.render("user/cart", { user: null, cartCount: 0 });
  }
};



// ================= ADD TO CART ====================
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

    let availableStock = product.quantity;

    // ----- SIZE VARIANT FIX -----
    if (product.sizeVariants && product.sizeVariants.length > 0) {
      if (!size) {
        return res.status(400).json({ success: false, message: "Please select a size" });
      }

      const sizeObj = product.sizeVariants.find(v => v.size === size);
      if (!sizeObj)
        return res.status(400).json({ success: false, message: "Invalid size selected" });

      availableStock = sizeObj.quantity;
    }

    let cart = await Cart.findOne({ userId });
    const unitPrice = product.salePrice || product.regularPrice;

    if (!cart) {
      if (quantity > availableStock) {
        return res.status(400).json({
          success: false,
          message: `Only ${availableStock} items available`,
        });
      }

      cart = new Cart({
        userId,
        items: [{
          productId,
          quantity,
          price: unitPrice,
          totalprice: unitPrice * quantity,
          ...(size && { size }),
        }],
      });

    } else {

      const item = cart.items.find(
        i => i.productId.equals(productId) && (i.size === size || !i.size)
      );

      if (item) {
        const newQty = item.quantity + quantity;

        if (newQty > 3)
          return res.status(400).json({ success: false, message: "Maximum 3 items allowed per product" });

        if (newQty > availableStock)
          return res.status(400).json({ success: false, message: `Only ${availableStock} items available` });

        item.quantity = newQty;
        item.totalprice = unitPrice * newQty;

      } else {

        if (quantity > availableStock)
          return res.status(400).json({ success: false, message: `Only ${availableStock} items available` });

        cart.items.push({
          productId,
          quantity,
          price: unitPrice,
          totalprice: unitPrice * quantity,
          ...(size && { size }),
        });
      }
    }

   // ✅ Update subtotal, shipping, total
const totals = calculateTotals(cart);

await cart.save();
const result = await Wishlist.updateOne(
  { userId },
  { $pull: { products: { productId: new mongoose.Types.ObjectId(productId) } } }
);








return res.json({
  success: true,
  message: size ? `Added size ${size} to cart` : "Added to cart",
  cart,
  totals
});

  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



// ================= GET CART ====================
const getCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Not authenticated" });

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const user = await User.findById(userId).select("name email");

    let totals = { subtotal: 0, shipping: 0, total: 0 };

    if (cart) {
      // ✅ REMOVE ITEMS WITH MISSING PRODUCTS
      cart.items = cart.items.filter(item => item.productId);

      cart.items.forEach(item => {
        const product = item.productId;

        const newPrice =
          product.salePrice > 0
            ? product.salePrice
            : product.regularPrice;

        if (item.price !== newPrice) {
          item.price = newPrice;
          item.totalprice = newPrice * item.quantity;
        }
      });

      totals = calculateTotals(cart);
      await cart.save();
    }

    res.json({
      success: true,
      cart: cart || { items: [] },
      user: user || null,
      totals
    });

  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({ success: false, message: "Error fetching cart" });
  }
};



// ================= REMOVE FROM CART ====================
const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId, size } = req.params;

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.json({ success: true, cart: { items: [] } });

    cart.items = cart.items.filter(i =>
      size
        ? !(i.productId.equals(productId) && i.size === size)
        : !i.productId.equals(productId)
    );
const totals = calculateTotals(cart);
await cart.save();

res.json({
  success: true,
  message: "Item removed",
  cart,
  totals
});


  } catch (err) {
    console.error("Error removing item:", err);
    res.status(500).json({ success: false, message: "Error removing item" });
  }
};

// ================= UPDATE QUANTITY ====================
const updateQuantity = async (req, res) => {
  try {
    

    const userId = req.session.userId;
    const { productId } = req.params;
    const { quantityDelta, size } = req.body;


    const cart = await Cart.findOne({ userId });
    if (!cart) {
      console.log("⚠ Cart not found");
      return res.json({ success: false, message: "Cart not found" });
    }


    // ---- FIND EXACT ITEM MATCH ----
    const item = cart.items.find(
      i => i.productId.equals(productId) && (i.size || "") === (size || "")
    );

   

    if (!item) {
      console.log("❌ No item matched with size:", size);
      return res.json({ success: false, message: "Item not found" });
    }

    const newQty = item.quantity + Number(quantityDelta);
   

    // ---- MIN LIMIT ----
    if (newQty < 1) {
    
      return res.json({ success: false, type: "min", message: "Minimum quantity is 1" });
    }

    // ---- MAX LIMIT ----
    if (newQty > 3) {
      console.log("❌ MAX LIMIT HIT (3)");
      return res.json({ success: false, type: "max", message: "Max 3 items allowed" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      console.log("❌ Product not found");
      return res.json({ success: false, message: "Product not found" });
    }

    console.log("Product found:", product.productName);
    console.log("Has variants:", product.hasVariants);

    let availableStock = product.quantity;

    // ---- VARIANT STOCK CHECK ----
    if (product.hasVariants && item.size) {
      const variant = product.sizeVariants.find(v => v.size === item.size);
      availableStock = variant ? variant.quantity : 0;

      console.log("Variant stock:", availableStock);

      if (newQty > availableStock) {
      
        return res.json({
          success: false,
          type: "stock",
          message: `Only ${availableStock} left for size ${item.size}`
        });
      }
    } 
    else {
      console.log("Normal stock:", product.quantity);

      if (newQty > product.quantity) {
        console.log("❌ Normal stock insufficient");
        return res.json({
          success: false,
          type: "stock",
          message: `Only ${product.quantity} left in stock`
        });
      }
    }

    // ---- UPDATE CART ----
    const unitPrice = product.salePrice || product.regularPrice;

    item.quantity = newQty;
    item.price = unitPrice;
    item.totalprice = unitPrice * newQty;

    await cart.save();

   const totals = calculateTotals(cart);
await cart.save();

return res.json({
  success: true,
  updatedItem: item,
  totals
});


  } catch (err) {
    console.error("UPDATE QUANTITY ERROR:", err);
    return res.json({ success: false, message: "Server error" });
  }
};



// ================= VALIDATE CART BEFORE CHECKOUT ====================
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

      if (!product || product.isBlocked || product.status === "Discontinued") {
        invalidItems.push({
          name: product?.productName || "Removed Product",
          reason: "Product unavailable",
        });
        return;
      }

      if (product.hasVariants && item.size) {
        const variant = product.sizeVariants.find(v => v.size === item.size);

        if (!variant || variant.quantity < item.quantity) {
          invalidItems.push({
            name: product.productName,
            reason: `Only ${variant?.quantity || 0} left for size ${item.size}`,
          });
        }

      } else {

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
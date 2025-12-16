const { ReturnDocument } = require("mongodb");
const Category = require("../../models/categorySchema");

const Product = require("../../models/productSchema");


// Helper: Recalculate offer for all products when category offer changes
const recalcProductsForCategory = async (categoryId) => {
  try {
    const products = await Product.find({ category: categoryId });

    for (const product of products) {
      await product.applyBestOffer();  // use the logic from product model
      await product.save();
    }
  } catch (err) {
    console.error("Error recalculating products for category:", err);
  }
};


const Categoryinfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";  
    const query = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const categoryData = await Category.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments(query);
    const totalPages = Math.ceil(totalCategories / limit);

    res.render("admin/category", {
      cat: categoryData,
      currentPage: page,
      totalPages,
      totalCategories,
      search   
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Category name is required" });
    }

    const trimmedName = name.trim();

    // Case-insensitive duplicate check
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
    });

   if (existingCategory) {
  return res.status(400).json({ error: "Category already exists" });
}

    const newCategory = new Category({
      name: trimmedName,
      description,
    });

    await newCategory.save();
    return res.status(201).json({ message: "Category added successfully" });
  } catch (error) {
    console.error("Error in addCategory:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};


const listCategory = async (req, res) => {
  try {
  
    console.log("Request body:", req.body);

    const { id } = req.body;
    if (!id) {
      console.log(" No ID provided!");
      return res.status(400).json({ success: false, message: "Category ID required" });
    }

    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    console.log("Category listed:", id);

    res.json({ success: true, message: "Category has been listed" });
  } catch (err) {
    console.error(" Error in listCategory:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const unlistCategory = async (req, res) => {
  try {
   
    console.log("Request body:", req.body); 

    const { id } = req.body;
    if (!id) {
      
      return res.status(400).json({ success: false, message: "Category ID required" });
    }

    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    console.log(" Category unlisted:", id);

    res.json({ success: true, message: "Category has been unlisted" });
  } catch (err) {
    console.error("Error in unlistCategory:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};



const getEditCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const category = await Category.findOne({ _id: id });
    if (!category) return res.redirect("/admin-error");
    res.render("admin/editcategory", { category });
  } catch (error) {
    console.error(error);
    res.redirect("/admin-error");
  }
};


const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { categoryName, description } = req.body;

    if (!categoryName || categoryName.trim() === "") {
      return res.status(400).json({ error: "Category name is required" });
    }

    const trimmedName = categoryName.trim();

    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
      _id: { $ne: id },
    });

    if (existingCategory) {
      return res.status(400).json({
        error: "Category already exists (case-insensitive match)",
      });
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { name: trimmedName, description },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ success: true, message: "Category updated successfully" });
  } catch (error) {
    console.error("Error in editCategory:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: "Category ID is required" });
    }

    const deleted = await Category.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    res.json({ success: true, message: "Category deleted successfully" });
  } catch (err) {
    console.error("Error in deleteCategory:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const setCategoryOffer = async (req, res) => {
  try {
    const { offer } = req.body;
    const { id } = req.params;

    const value = Number(offer);
    if (isNaN(value) || value < 0 || value > 89) {
      return res.json({ success: false, message: "Offer must be between 0 and 89" });
    }

    const category = await Category.findByIdAndUpdate(
      id,
      { categoryOffer: value },
      { new: true }
    );

    if (!category) {
      return res.json({ success: false, message: "Category not found" });
    }

    await recalcProductsForCategory(id);

    return res.json({ success: true });
  } catch (err) {
    console.error("Error in setCategoryOffer:", err);
    return res.json({ success: false, message: "Internal server error" });
  }
};

const removeCategoryOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByIdAndUpdate(
      id,
      { categoryOffer: 0 },
      { new: true }
    );

    if (!category) {
      return res.json({ success: false, message: "Category not found" });
    }

    await recalcProductsForCategory(id);

    return res.json({ success: true });
  } catch (err) {
    console.error("Error in removeCategoryOffer:", err);
    return res.json({ success: false, message: "Internal server error" });
  }
};




module.exports={
  Categoryinfo,
    addCategory,
 listCategory,
 unlistCategory,
 getEditCategory,
 editCategory,
 deleteCategory,
 setCategoryOffer,
 removeCategoryOffer,
 recalcProductsForCategory
 






}
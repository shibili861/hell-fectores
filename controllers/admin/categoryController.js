const { ReturnDocument } = require("mongodb");
const Category = require("../../models/categorySchema");






const Categoryinfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 2;
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
    const { name, description } = req.body;
    try {
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" });
        }

        const newCategory = new Category({
            name,
            description,
        });

        await newCategory.save();
        return res.status(201).json({ message: "Category added successfully" });
    } catch (error) {
        console.error(error);
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

    const existingCategory = await Category.findOne({ name: categoryName, _id: { $ne: id } });
    if (existingCategory) {
      return res.status(400).send("Category exists, please choose another name");
    }

    const updateCategory = await Category.findByIdAndUpdate(
      id,
      { name: categoryName, description },
      { new: true }
    );

    if (!updateCategory) return res.status(404).send("Category not found");

    res.redirect("/admin/category");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};






module.exports={
  Categoryinfo,
    addCategory,
 listCategory,
 unlistCategory,
 getEditCategory,
 editCategory,




}
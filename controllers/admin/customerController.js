const User = require("../../models/userSchema");

const customerinfo = async (req, res) => {
    try {
          if (Object.keys(req.query).length > 0) {
            console.log('Query Params:', req.query);
        }

        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1;
        const limit = 6;

        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ],
        })
        .sort({ createdAt: -1 })   // latest users first
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();

        const count = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ],
        }).countDocuments();
         
        res.render('admin/customers', {
            data: userData,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            search: search
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};


const customerBlocked = async (req, res) => {
    try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        console.log("Blocking user:", id);   // <-- debug log
        res.redirect("/admin/users");
    } catch (error) {
        res.redirect("/admin-error");
    }
};

const customerunBlocked = async (req, res) => {
    try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        console.log("unBlocking user:", id);   // <-- debug log
        res.redirect("/admin/users");
    } catch (error) {
        res.redirect("/adimin/admin-error");
    }
};



module.exports = {
    customerinfo,
    customerBlocked,
    customerunBlocked,


};

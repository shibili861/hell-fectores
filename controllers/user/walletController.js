
const mongoose = require('mongoose');
const User = require("../../models/userSchema");
const Wallet=require("../../models/walletSchema");


const getWalletPage = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect("/login");

    // Load user (important!)
    const user = await User.findById(userId).lean();

    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        transactions: []
      });
    }

    // Sorting transactions
    const transactions = wallet.transactions.sort(
      (a, b) => b.createdAt - a.createdAt
    );

    res.render("user/wallet", {
      user,          
      wallet,
      transactions
    });

  } catch (error) {
    console.error("Wallet Page Error:", error);
    res.redirect("/error");
  }
};


module.exports = {
  getWalletPage
};

const User = require("../../models/userSchema");
const { creditWallet } = require("../../helpers/walletHelper");

const NEW_USER_BONUS = 100;
const REFERRER_BONUS = 100;

const applyReferralCode = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.json({ success: false, message: "Login required" });
    }

    const user = await User.findById(userId);
    console.log(user, "hlo user");

    //  User record not found 
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    //  Already redeemed 
    if (user.redeemed) {
      return res.json({ success: false, message: "Already redeemed or skipped" });
    }

    const { code } = req.body;

    if (!code || !code.trim()) {
      return res.json({ success: false, message: "Referral code is required" });
    }

    const referrer = await User.findOne({ referralCode: code.trim() });

    if (!referrer) {
      return res.json({ success: false, message: "Invalid referral code" });
    }

    if (referrer._id.equals(user._id)) {
      return res.json({ success: false, message: "You cannot use your own code!" });
    }

    //  Credit wallets
    await creditWallet(user._id, NEW_USER_BONUS, "Referral Bonus");
    await creditWallet(referrer._id, REFERRER_BONUS, `Referral from ${user.name}`);

    //  Update status
    user.redeemed = true;
    user.referralPromptShown = true;
    await user.save();

    referrer.redeemedUsers.push(user._id);
    await referrer.save();

    return res.json({ success: true, message: "Referral applied successfully!" });
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: "Server error" });
  }
};

const skipReferral = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.json({ success: false, message: "Login required" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    user.redeemed = true;
    user.referralPromptShown = true;
    await user.save();

    return res.json({ success: true });
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: "Error skipping referral" });
  }
};


module.exports={
  applyReferralCode,
  skipReferral


}
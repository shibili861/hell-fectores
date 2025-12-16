const Wallet = require("../models/walletSchema");

async function creditWallet(userId, amount, reason, orderId = null) {
  let wallet = await Wallet.findOne({ userId });

  // If wallet doesn't exist → create it
  if (!wallet) {
    wallet = new Wallet({
      userId,
      balance: 0,
      transactions: []
    });
  }

  // Add money
  wallet.balance += amount;

  wallet.transactions.push({
    type: "Credit",
    amount,
    reason,
    orderId
  });

  await wallet.save();
}

async function debitWallet(userId, amount, reason, orderId = null) {
  let wallet = await Wallet.findOne({ userId });

  if (!wallet) throw new Error("Wallet not found");
  if (wallet.balance < amount) throw new Error("Insufficient wallet balance");

  wallet.balance -= amount;

  wallet.transactions.push({
    type: "Debit",
    amount,
    reason,
    orderId
  });

  await wallet.save();
}

module.exports = {
  creditWallet,
  debitWallet
};

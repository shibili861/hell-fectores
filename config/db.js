const mongoose=require('mongoose');
const env=require('dotenv').config();

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is undefined");
    }
    

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("db connected");
  } catch (error) {
    console.error("db connection error", error.message);
    process.exit(1);
  }
};
module.exports=connectDB
const mongoose=require("mongoose")
const {Schema}=mongoose;

const brandSchema=new Schema({
    brandName:{
        type:String,
        required:true
    },
    brandImage:{
        type:[String],
        type:String
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    createdAT:{
        type:Date,
        default:Date.now
    }
})
const Brand=mongoose.model("Brand",brandSchema);
mudule.exports=Brand;
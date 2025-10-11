const mongoose=require(mongoose);
const {Schema}=mongoose;
const {v4:uuidv4}=require('uuid');
const address = require('./addressSchema');

const orderSchema=new Schema({
    orderId:{
        type:String,
        default:()=>uuidv4(),
        unique:true
    },
    orderedItems:[{
        product:{
           type:Schema.Types.ObjectId,
           ref:"product",
           required:true 
        },
        quantity:{
            type:Number,
            required:true
        },
        price:{
            type:Number,
            default:0
        }
    }],
    totalPrice:{
        type:Number,
        required:true

    },
    discount:{
        type:Number,
        default:0
    },
    finalAmount:{
        type:Number,
        required:true
    },
    address:{
         type:Schema.Types.ObjectId,
         ref:"user",
         requird:true
    },
    invoiceDate:{
        type:Date
    },
    status:{
        type:String,
        required:true,
        enum:['pending','processing','shipped','deliverd','cancelled','return Request','Returned']
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    couponApplied:{
       type:Boolean,
       default:false 
    }
})
const order=mongoose.model('order',ordersSchema);
module.exports=order;
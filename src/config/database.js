// config/db.js
import { connect } from "mongoose";

const connectDB = async () => {
  try {
    const conn = await connect(process.env.MONGO_URI, {});
    console.log(`MongoDB Connected from DB file : ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

const createIndexes = async () => {
  // User indexes
  await mongoose
    .model("User")
    .createIndexes([{ mobile: 1 }, { referralCode: 1 }, { city: 1, area: 1 }]);

  // Product indexes
  await mongoose
    .model("Product")
    .createIndexes([
      { sku: 1 },
      { category: 1 },
      { brand: 1 },
      { "specifications.key": 1 },
    ]);

  // Coupon indexes
  await mongoose
    .model("Coupon")
    .createIndexes([
      { code: 1 },
      { "targeting.type": 1 },
      { validUntil: 1, status: 1 },
    ]);

  // UserCoupon indexes
  await mongoose
    .model("UserCoupon")
    .createIndexes([
      { userId: 1, status: 1 },
      { uniqueCode: 1 },
      { couponId: 1 },
    ]);

  // Purchase indexes
  await mongoose
    .model("Purchase")
    .createIndexes([
      { userId: 1, createdAt: -1 },
      { storeId: 1, createdAt: -1 },
      { invoiceNumber: 1 },
    ]);

  console.log("Database indexes created successfully");
};

export default connectDB;

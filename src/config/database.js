// config/db.js
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }

    console.log("🔗 Connecting to MongoDB...");
    // console.log("MONGO_URI:", process.env.MONGO_URI);

    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📦 Database: ${conn.connection.name}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:");
    console.error(error.message);

    process.exit(1);
  }
};

/* ---------------- INDEX CREATION ---------------- */
export const createIndexes = async () => {
  try {
    console.log("📌 Creating database indexes...");

    const User = mongoose.model("User");
    const Product = mongoose.model("Product");
    const Coupon = mongoose.model("Coupon");
    const UserCoupon = mongoose.model("UserCoupon");
    const Purchase = mongoose.model("Purchase");

    // User indexes
    await User.collection.createIndex({ mobile: 1 });
    await User.collection.createIndex({ referralCode: 1 });
    await User.collection.createIndex({ city: 1, area: 1 });

    // Product indexes
    await Product.collection.createIndex({ sku: 1 });
    await Product.collection.createIndex({ category: 1 });
    await Product.collection.createIndex({ brand: 1 });
    await Product.collection.createIndex({ "specifications.key": 1 });

    // Coupon indexes
    await Coupon.collection.createIndex({ code: 1 });
    await Coupon.collection.createIndex({ "targeting.type": 1 });
    await Coupon.collection.createIndex({ validUntil: 1, status: 1 });

    // UserCoupon indexes
    await UserCoupon.collection.createIndex({ userId: 1, status: 1 });
    await UserCoupon.collection.createIndex({ uniqueCode: 1 });
    await UserCoupon.collection.createIndex({ couponId: 1 });

    // Purchase indexes
    await Purchase.collection.createIndex({ userId: 1, createdAt: -1 });
    await Purchase.collection.createIndex({ storeId: 1, createdAt: -1 });
    await Purchase.collection.createIndex({ invoiceNumber: 1 });

    console.log("✅ Database indexes created successfully");
  } catch (error) {
    console.error("❌ Error creating indexes:", error.message);
  }
};

export default connectDB;

import mongoose from "mongoose";
import dotenv from "dotenv";
import Coupon from "./models/Coupon.model.js";

dotenv.config();

async function expireCoupons() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const now = new Date();

    const result = await Coupon.updateMany(
      {
        // Target coupons where neverExpires is NOT true (handles false AND undefined)
        neverExpires: { $ne: true },
        // Target coupons where the date has passed
        validUntil: { $lt: now },
        // Only update if not already marked expired
        status: { $ne: "EXPIRED" },
      },
      {
        $set: { status: "EXPIRED" },
      },
    );

    console.log("\n" + "=".repeat(30));
    console.log(`✅ SYNC COMPLETE`);
    console.log(`📅 Reference Time: ${now.toLocaleString()}`);
    console.log(`📝 Coupons Updated: ${result.modifiedCount}`);
    console.log("=".repeat(30) + "\n");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ ERROR:", error);
    process.exit(1);
  }
}

expireCoupons();

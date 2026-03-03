import mongoose from "mongoose";
import dotenv from "dotenv";
import Coupon from "./models/Coupon.model.js";

dotenv.config();

async function diagnoseAndExpire() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const now = new Date();

    // 1. Check what collection Mongoose is actually looking at
    const collectionName = Coupon.collection.name;
    const totalRawDocs = await mongoose.connection.db
      .collection(collectionName)
      .countDocuments();
    const totalWithModel = await Coupon.countDocuments({});

    console.log("\n--- DATABASE DIAGNOSTICS ---");
    console.log(`Target Collection: ${collectionName}`);
    console.log(`Total Documents (Raw DB): ${totalRawDocs}`);
    console.log(`Total Documents (via Model): ${totalWithModel}`);
    console.log(`---------------------------\n`);

    if (totalWithModel === 0) {
      console.log(
        "❌ ERROR: No documents found. Check if your MONGO_URI points to the correct database (check the DB name at the end of the URI string).",
      );
      await mongoose.connection.close();
      return;
    }

    // 2. Perform the update
    const result = await Coupon.updateMany(
      {
        neverExpires: false,
        validUntil: { $lt: now },
        status: { $ne: "EXPIRED" },
      },
      { $set: { status: "EXPIRED" } },
    );

    console.log("📊 FINAL REPORT");
    console.table({
      "Total Coupons": totalWithModel,
      "Expired by Date": result.matchedCount,
      "Updated to EXPIRED": result.modifiedCount,
    });

    await mongoose.connection.close();
  } catch (error) {
    console.error("❌ CRITICAL ERROR:", error);
    process.exit(1);
  }
}

diagnoseAndExpire();

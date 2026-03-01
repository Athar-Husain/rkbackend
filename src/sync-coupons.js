import dotenv from "dotenv";
import mongoose from "mongoose";
import Coupon from "./models/Coupon.model.js";
import UserCoupon from "./models/UserCoupon.model.js";

dotenv.config();

const syncCoupons = async () => {
  try {
    console.log("\n=========================================");
    console.log("🚀  COUPON DATA SYNC STARTING");
    console.log("=========================================\n");

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB successfully.\n");

    const coupons = await Coupon.find({});

    // Counters for the final report
    let totalChecked = coupons.length;
    let fixedCount = 0;
    let alreadyCorrect = 0;

    for (const coupon of coupons) {
      // Count how many UserCoupons are ACTUALLY status "USED"
      const actualUsedCount = await UserCoupon.countDocuments({
        couponId: coupon._id,
        status: "USED",
      });

      const currentCounter = coupon.currentRedemptions || 0;

      if (currentCounter !== actualUsedCount) {
        console.log(`⚠️  FIXING [${coupon.code}]:`);
        console.log(`   - Reported: ${currentCounter}`);
        console.log(`   - Actual:   ${actualUsedCount}`);

        // Update the master coupon
        coupon.currentRedemptions = actualUsedCount;
        await coupon.save();

        fixedCount++;
      } else {
        console.log(
          `✨  OK [${coupon.code}]: Counter matches (${actualUsedCount})`,
        );
        alreadyCorrect++;
      }
    }

    // FINAL REPORT TABLE
    console.log("\n=========================================");
    console.log("📊  FINAL SYNC REPORT");
    console.log("=========================================");
    console.table({
      "Total Coupons Checked": totalChecked,
      "Fixed (Had Mismatches)": fixedCount,
      "Already Correct": alreadyCorrect,
    });
    console.log("=========================================\n");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ CRITICAL ERROR:", error);
    process.exit(1);
  }
};

syncCoupons();

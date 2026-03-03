import mongoose from "mongoose";
import dotenv from "dotenv";
import Coupon from "./models/Coupon.model.js";

dotenv.config();

async function deepPeek() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const now = new Date();

    const allCoupons = await Coupon.find({}).limit(3).lean();

    console.log("\n--- DATA INSPECTION ---");
    allCoupons.forEach((c, i) => {
      console.log(`Coupon #${i + 1}: ${c.code}`);
      console.log(
        ` - neverExpires: ${c.neverExpires} (Type: ${typeof c.neverExpires})`,
      );
      console.log(
        ` - validUntil:   ${c.validUntil} (Type: ${c.validUntil instanceof Date ? "Date Object" : typeof c.validUntil})`,
      );
      console.log(` - Status:       ${c.status}`);

      const isExpiredByDate = c.validUntil < now;
      console.log(` - Is date < now? ${isExpiredByDate}`);
      console.log("-----------------------");
    });

    // RUN THE UPDATE WITHOUT THE 'neverExpires' FILTER JUST TO TEST
    const result = await Coupon.updateMany(
      {
        validUntil: { $lt: now },
        status: { $ne: "EXPIRED" },
      },
      { $set: { status: "EXPIRED" } },
    );

    console.log(
      `\nFinal result of forced update: ${result.modifiedCount} updated.`,
    );

    await mongoose.connection.close();
  } catch (error) {
    console.error("❌ ERROR:", error);
    process.exit(1);
  }
}

deepPeek();

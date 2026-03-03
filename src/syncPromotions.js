import mongoose from "mongoose";
import dotenv from "dotenv";
import Promotion from "./models/Promotion.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function syncPromotions() {
  try {
    console.log("\n=========================================");
    console.log("🚀  PROMOTIONS DATA SYNC STARTING");
    console.log("=========================================\n");

    // Connect without unsupported options
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB successfully.\n");

    const promotions = await Promotion.find({});
    console.log(`Found ${promotions.length} promotions\n`);

    let updatedCount = 0;

    for (const promo of promotions) {
      let updated = false;

      if (promo.targeting?.geographic?.cities?.length) {
        promo.targeting.geographic.cities =
          promo.targeting.geographic.cities.map(
            (id) => new mongoose.Types.ObjectId(id),
          );
        updated = true;
      }

      if (promo.targeting?.geographic?.areas?.length) {
        promo.targeting.geographic.areas = promo.targeting.geographic.areas.map(
          (id) => new mongoose.Types.ObjectId(id),
        );
        updated = true;
      }

      if (updated) {
        await promo.save();
        updatedCount++;
        console.log(`✅ Updated promotion ${promo._id}`);
      } else {
        console.log(`✨ Already correct ${promo._id}`);
      }
    }

    console.log("\n=========================================");
    console.log("📊  FINAL SYNC REPORT");
    console.log("=========================================");
    console.table({
      "Total Promotions Checked": promotions.length,
      "Updated Promotions": updatedCount,
      "Already Correct": promotions.length - updatedCount,
    });
    console.log("=========================================\n");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ CRITICAL ERROR:", error);
    process.exit(1);
  }
}

syncPromotions();

import "dotenv/config";
import mongoose from "mongoose";

import { seedCityAreas } from "./cityArea.seeder.js";
import { seedStores } from "./store.seeder.js";
import { seedUsers } from "./user.seeder.js";
import { seedProducts } from "./product.seeder.js";
import { seedCoupons } from "./coupon.seeder.js";
import { seedUserCoupons } from "./usercoupon.seeder.js";
import { seedPurchases } from "./purchase.seeder.js";
import { seedNotificationLogs } from "./notificationLog.seeder.js";
import connectDB from "../config/database.js";
import { seedStaff } from "./staff.seeder.js";

// import connectDB from "./src/config/database.js";

connectDB();

const runSeeders = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("🌱 Seeding started...");

    // await seedCityAreas();
    // const stores = await seedStores();
    // const users = await seedUsers(stores);
    // const products = await seedProducts(stores);
    // const coupons = await seedCoupons();
    // await seedUserCoupons(users, coupons);
    // await seedPurchases(users, stores, products);
    // await seedNotificationLogs(users);

    await seedCityAreas();
    const stores = await seedStores();
    const staff = await seedStaff(stores);
    const users = await seedUsers(stores);
    const products = await seedProducts(stores);
    const coupons = await seedCoupons();
    await seedUserCoupons(users, coupons);
    await seedPurchases(users, stores, products);
    await seedNotificationLogs(users);

    console.log("🎉 Seeding completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

runSeeders();

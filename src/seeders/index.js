import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../config/database.js";

/* =========================
   SEEDERS
========================= */
import { seedCityAreas } from "./cityArea.seeder.js";
import { seedStores } from "./store.seeder.js";
import { seedStaff } from "./staff.seeder.js";
import { seedUsers } from "./user.seeder.js";
import { seedProducts } from "./product.seeder.js";
import { seedCoupons } from "./coupon.seeder.js";
import { seedUserCoupons } from "./usercoupon.seeder.js";
import { seedPurchases } from "./purchase.seeder.js";
import { seedNotificationLogs } from "./notificationLog.seeder.js";
import { seedBanners } from "./banner.seeder.js";
import { seedPromotions } from "./promotion.seeder.js";

/* =========================
   RUN ALL SEEDERS
========================= */
const runSeeders = async () => {
  try {
    /* =========================
       DB CONNECTION
    ========================= */
    await connectDB();

    console.log("🌱 Seeding started...\n");

    /* =========================
       CITY & AREA DATA
    ========================= */
    const cityAreas = await seedCityAreas();

    /* =========================
       STORES
    ========================= */
    const stores = await seedStores();

    /* =========================
       STAFF
    ========================= */
    const staff = await seedStaff(stores);

    /* =========================
       USERS
    ========================= */
    const users = await seedUsers(stores);

    /* =========================
       PRODUCTS
    ========================= */
    const products = await seedProducts(stores);

    /* =========================
       COUPONS
    ========================= */
    const coupons = await seedCoupons();

    /* =========================
       USER COUPONS
    ========================= */
    await seedUserCoupons(users, coupons);

    /* =========================
       PURCHASES
    ========================= */
    await seedPurchases(users, stores, products);

    /* =========================
       NOTIFICATION LOGS
    ========================= */
    await seedNotificationLogs(users);

    /* =========================
       BANNERS
    ========================= */
    await seedBanners(users, stores);

    /* =========================
       PROMOTIONS
    ========================= */
    await seedPromotions(users, stores, products, cityAreas);

    console.log("\n🎉 All seeders completed successfully");

    /* =========================
       CLEAN EXIT
    ========================= */
    await mongoose.disconnect();

    console.log("🔌 MongoDB disconnected");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seeding failed:");
    console.error(error);

    await mongoose.disconnect();

    process.exit(1);
  }
};

runSeeders();

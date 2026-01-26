import Staff from "../models/Staff.model.js";

/**
 * 🌱 Seed Staff
 * @param {Array} stores - seeded stores
 */
export const seedStaff = async (stores = []) => {
  try {
    if (!stores.length) {
      throw new Error("No stores provided to seedStaff");
    }

    console.log("👥 Seeding staff...");

    await Staff.deleteMany();

    const mainStore = stores[0]._id;

    const staffData = [
      {
        storeId: mainStore,
        name: "Admin User",
        username: "admin",
        password: "Admin@123",
        userType: "admin",
        role: "admin",
        permissions: {
          canVerifyCoupon: true,
          canRedeemCoupon: true,
          canCreatePurchase: true,
          canViewBranchReports: true,
        },
      },
      {
        storeId: mainStore,
        name: "Store Manager",
        username: "manager",
        password: "Manager@123",
        userType: "staff",
        role: "manager",
        permissions: {
          canVerifyCoupon: true,
          canRedeemCoupon: true,
          canCreatePurchase: true,
          canViewBranchReports: true,
        },
      },
      {
        storeId: mainStore,
        name: "Counter Staff",
        username: "staff1",
        password: "Staff@123",
        userType: "staff",
        role: "staff",
        permissions: {
          canVerifyCoupon: true,
          canRedeemCoupon: false,
          canCreatePurchase: true,
          canViewBranchReports: false,
        },
      },
    ];

    // IMPORTANT: insertMany DOES NOT run pre-save hooks reliably
    // So we use create() instead
    const createdStaff = [];
    for (const staff of staffData) {
      const doc = await Staff.create(staff);
      createdStaff.push(doc);
    }

    console.log(`✅ Seeded ${createdStaff.length} staff members`);
    return createdStaff;
  } catch (error) {
    console.error("❌ Staff seeding failed:", error);
    throw error;
  }
};

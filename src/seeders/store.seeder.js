import Store from "../models/Store.model.js";

// ===============================
// Seed Data
// ===============================
const stores = [
  {
    name: "RK Electronics - Jagruti Nagar",
    type: "MAIN",
    location: {
      address: "12, Jagruti Nagar Main Road",
      area: "jagruti nagar",
      city: "ballari",
      pincode: "583101",
      landmark: "Near City Bus Stand",
    },
    contact: {
      phone: "9876543210",
      whatsapp: "9876543210",
      email: "jagruti@rkelectronics.com",
      managerName: "Ramesh Kumar",
    },
  },
  {
    name: "RK Electronics - Cantonment",
    type: "BRANCH",
    location: {
      address: "45, Cantonment Road",
      area: "cantonment",
      city: "ballari",
      pincode: "583104",
      landmark: "Opp Police Station",
    },
    contact: {
      phone: "9876543222",
      whatsapp: "9876543222",
      email: "cantonment@rkelectronics.com",
      managerName: "Suresh Naik",
    },
  },
  {
    name: "RK Electronics - Hosapete",
    type: "SUB_BRANCH",
    location: {
      address: "88, College Road",
      area: "college road",
      city: "hosapete",
      pincode: "583201",
      landmark: "Near Engineering College",
    },
    contact: {
      phone: "9876543333",
      whatsapp: "9876543333",
      email: "hosapete@rkelectronics.com",
      managerName: "Anita Rao",
    },
  },
];

// ===============================
// Seeder Logic
// ===============================
export const seedStores = async () => {
  try {
    console.log("🏬 Seeding stores...");

    await Store.deleteMany();
    console.log("Existing stores cleared");

    const createdStores = [];

    for (const store of stores) {
      const created = await Store.create(store); // ✅ triggers pre-save hook
      createdStores.push(created);
    }

    console.log(`✅ Seeded ${createdStores.length} stores successfully`);
    return createdStores;
  } catch (error) {
    console.error("❌ Store seeding failed", error);
    throw error;
  }
};

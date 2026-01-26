import Store from "../models/Store.model.js";

export const seedStores = async () => {
  await Store.deleteMany();

  const stores = await Store.insertMany([
    {
      name: "RK Electronics Andheri",
      code: "MUMAND001",
      location: {
        address: "SV Road",
        city: "Mumbai",
        area: "Andheri",
        pincode: "400058",
      },
      contact: {
        phone: "9999999999",
      },
    },
  ]);

  console.log("✅ Stores seeded");
  return stores;
};



import mongoose from "mongoose";
import dotenv from "dotenv";
import Store from "../models/Store.model.js"; // adjust path if needed

dotenv.config();

// ===============================
// MongoDB Connection
// ===============================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed", error);
    process.exit(1);
  }
};

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
const seedStores = async () => {
  try {
    await connectDB();

    // 🔥 Clear existing stores
    await Store.deleteMany();
    console.log("Existing stores cleared");

    // 🚀 Insert new stores
    const createdStores = await Store.insertMany(stores);
    console.log(`Seeded ${createdStores.length} stores successfully`);

    process.exit();
  } catch (error) {
    console.error("Seeder failed", error);
    process.exit(1);
  }
};

seedStores();

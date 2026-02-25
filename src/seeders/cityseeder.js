import mongoose from "mongoose";
import CityArea from "../models/CityArea.model.js";
import dotenv from "dotenv";

dotenv.config();

const citiesData = [
  {
    city: "Ballari",
    areas: [
      { name: "Cowl Bazar", pincodes: ["583101"] },
      { name: "SN Pet", pincodes: ["583102"] },
      { name: "BCC Layout", pincodes: ["583103"] },
      { name: "Gandhi Nagar", pincodes: ["583104"] },
    ],
    isActive: true,
  },
  {
    city: "Siruguppa",
    areas: [
      { name: "Main Road", pincodes: ["583121"] },
      { name: "Railway Station Road", pincodes: ["583121"] },
      { name: "Market Area", pincodes: ["583121"] },
    ],
    isActive: true,
  },
  {
    city: "Hospet",
    areas: [
      { name: "Hampi Road", pincodes: ["583201"] },
      { name: "Station Road", pincodes: ["583202"] },
      { name: "Vijayanagar", pincodes: ["583203"] },
    ],
    isActive: true,
  },
  {
    city: "Koppal",
    areas: [
      { name: "Main Bazar", pincodes: ["583231"] },
      { name: "Gandhi Chowk", pincodes: ["583232"] },
      { name: "New Town", pincodes: ["583233"] },
    ],
    isActive: true,
  },
  {
    city: "Raichur",
    areas: [
      { name: "Fort Area", pincodes: ["584101"] },
      { name: "Gunj", pincodes: ["584102"] },
      { name: "Siddeshwara", pincodes: ["584103"] },
    ],
    isActive: true,
  },
];

const seedCities = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB");

    // Clear existing data
    await CityArea.deleteMany({});
    console.log("Cleared existing cities data");

    // Insert new data
    await CityArea.insertMany(citiesData);
    console.log("Cities seeded successfully");

    // Verify data
    const count = await CityArea.countDocuments();
    console.log(`Total cities inserted: ${count}`);

    // List all cities with areas
    const cities = await CityArea.find({}).select("city areas.name");
    console.log("\nSeeded Cities:");
    cities.forEach((city) => {
      console.log(`\n${city.city}:`);
      city.areas.forEach((area) => {
        console.log(`  - ${area.name}`);
      });
    });

    process.exit(0);
  } catch (error) {
    console.error("Error seeding cities:", error);
    process.exit(1);
  }
};

seedCities();

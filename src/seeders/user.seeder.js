import User from "../models/User.model.js";
import CityArea from "../models/CityArea.model.js";

export const seedUsers = async (stores) => {
  console.log("👤 Seeding users...");
  await User.deleteMany();

  /* ---------------- BALLARI USER ---------------- */
  const ballariCity = await CityArea.findOne({ city: "Ballari" });
  if (!ballariCity) {
    throw new Error("City 'Ballari' not found");
  }

  const cowlBazar = ballariCity.areas.find((a) => a.name === "Cowl Bazar");
  if (!cowlBazar) {
    throw new Error("Area 'Cowl Bazar' not found in Ballari");
  }

  /* ---------------- SIRUGUPPA USER ---------------- */
  const siruguppaCity = await CityArea.findOne({ city: "Siruguppa" });
  if (!siruguppaCity) {
    throw new Error("City 'Siruguppa' not found");
  }

  const mainRoad = siruguppaCity.areas.find((a) => a.name === "Main Road");
  if (!mainRoad) {
    throw new Error("Area 'Main Road' not found in Siruguppa");
  }

  /* ---------------- CREATE USERS ---------------- */
  const users = await User.create([
    {
      name: "Rahul Kumar",
      mobile: "9876543210",
      email: "rahul@test.com",
      password: "password123",

      city: ballariCity._id,
      area: cowlBazar._id,
      cityName: ballariCity.city,
      areaName: cowlBazar.name,

      registrationStore: stores[0]?._id,
      isVerified: true,
    },
    {
      name: "Ayesha Khan",
      mobile: "9123456789",
      email: "ayesha@test.com",
      password: "password123",

      city: siruguppaCity._id,
      area: mainRoad._id,
      cityName: siruguppaCity.city,
      areaName: mainRoad.name,

      registrationStore: stores[1]?._id,
      isVerified: true,
    },
  ]);

  console.log(`✅ ${users.length} users seeded`);
  return users;
};

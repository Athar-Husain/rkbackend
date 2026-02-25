import CityArea from "../models/CityArea.model.js";

export const seedCityAreas = async () => {
  await CityArea.deleteMany();

  await CityArea.insertMany([
    {
      city: "Mumbai",
      areas: [
        { name: "Andheri", pincodes: ["400053", "400058"] },
        { name: "Borivali", pincodes: ["400091"] },
      ],
    },
    {
      city: "Delhi",
      areas: [{ name: "Connaught Place", pincodes: ["110001"] }],
    },
  ]);

  console.log("✅ CityAreas seeded");
};

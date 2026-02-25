import CityArea from "../models/CityArea.model.js";

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

export const seedCityAreas = async () => {
  console.log("🌆 Seeding city & area data...");

  await CityArea.deleteMany({});
  await CityArea.insertMany(citiesData);

  const count = await CityArea.countDocuments();
  console.log(`✅ ${count} cities inserted`);

  const cities = await CityArea.find().select("city areas.name");
  cities.forEach((c) => {
    console.log(`• ${c.city}: ${c.areas.map((a) => a.name).join(", ")}`);
  });
};

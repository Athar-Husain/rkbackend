import User from "../models/User.model.js";

export const seedUsers = async (stores) => {
  await User.deleteMany();

  const users = await User.create([
    {
      name: "Rahul Kumar",
      mobile: "9876543210",
      email: "rahul@test.com",
      password: "password123",
      city: "Mumbai",
      area: "Andheri",
      registrationStore: stores[0]._id,
      isVerified: true,
    },
  ]);

  console.log("✅ Users seeded");
  return users;
};

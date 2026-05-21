// banner.seeder.js

import Banner from "../models/Banner.model.js";

export const seedBanners = async (users, stores) => {
  console.log("🎯 Seeding banners...");

  await Banner.deleteMany();

  const now = new Date();

  const banners = await Banner.create([
    {
      title: "Big TV Sale",
      description: "Up to 40% OFF on Smart TVs",

      imageUrl: "https://dummyimage.com/1200x400/000/fff",
      imageAlt: "TV Sale Banner",

      targeting: {
        type: "ALL",
      },

      actionType: "CATEGORY",
      actionValue: "television",

      displayOrder: 1,

      isActive: true,
      startDate: now,
      endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    },

    {
      title: "Exclusive Mobile Offers",
      description: "Special offers for Ballari customers",

      imageUrl: "https://dummyimage.com/1200x400/111/fff",

      targeting: {
        type: "GEOGRAPHIC",
        geographic: {
          stores: [stores[0]._id],
        },
      },

      actionType: "CATEGORY",
      actionValue: "mobile",

      displayOrder: 2,

      isActive: true,
      startDate: now,
      endDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
    },

    {
      title: "Welcome Offer",
      description: "Special welcome coupon for selected users",

      imageUrl: "https://dummyimage.com/1200x400/333/fff",

      targeting: {
        type: "INDIVIDUAL",
        users: [users[0]._id],
      },

      actionType: "COUPON",
      actionValue: "WELCOME100",

      displayOrder: 3,

      isActive: true,
      startDate: now,
      endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  ]);

  console.log(`✅ ${banners.length} banners seeded`);

  return banners;
};
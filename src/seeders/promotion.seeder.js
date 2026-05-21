import Promotion from "../models/Promotion.model.js";

export const seedPromotions = async (
  users,
  stores,
  products,
  cityAreas = [],
) => {
  console.log("🎁 Seeding promotions...");

  await Promotion.deleteMany();

  const now = new Date();

  const promotions = await Promotion.create([
    /* =====================================================
       ALL USERS PROMOTION
    ===================================================== */
    {
      title: "Mega Electronics Festival",
      description:
        "Get huge discounts on TVs, Mobiles, Refrigerators and more.",

      shortDescription: "Up to 50% OFF on electronics",

      bannerImage: "https://dummyimage.com/1200x500/000/fff",
      thumbnailImage: "https://dummyimage.com/400x200/000/fff",

      targeting: {
        type: "ALL",
      },

      validFrom: now,
      validUntil: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),

      displayOrder: 1,
      featured: true,
      priority: 10,

      status: "ACTIVE",
    },

    /* =====================================================
       GEOGRAPHIC PROMOTION
    ===================================================== */
    {
      title: "Ballari Exclusive Offer",
      description: "Special offers available only in Ballari stores.",

      shortDescription: "Exclusive Ballari Deals",

      bannerImage: "https://dummyimage.com/1200x500/111/fff",
      thumbnailImage: "https://dummyimage.com/400x200/111/fff",

      targeting: {
        type: "GEOGRAPHIC",

        geographic: {
          stores: [stores[0]?._id],

          cities: cityAreas[0]?._id ? [cityAreas[0]._id] : [],
        },
      },

      validFrom: now,
      validUntil: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),

      displayOrder: 2,
      featured: true,
      priority: 8,

      status: "ACTIVE",
    },

    /* =====================================================
       INDIVIDUAL USER PROMOTION
    ===================================================== */
    {
      title: "Special Reward For Rahul",
      description: "Exclusive reward promotion for premium customer.",

      shortDescription: "Exclusive User Offer",

      bannerImage: "https://dummyimage.com/1200x500/222/fff",
      thumbnailImage: "https://dummyimage.com/400x200/222/fff",

      targeting: {
        type: "INDIVIDUAL",

        users: users[0]?._id ? [users[0]._id] : [],
      },

      validFrom: now,
      validUntil: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),

      displayOrder: 3,
      featured: false,
      priority: 7,

      status: "ACTIVE",
    },

    /* =====================================================
       SEGMENT BASED PROMOTION
    ===================================================== */
    {
      title: "Loyal Customer Bonus",
      description: "Extra cashback for loyal customers.",

      shortDescription: "Loyalty Rewards",

      bannerImage: "https://dummyimage.com/1200x500/333/fff",
      thumbnailImage: "https://dummyimage.com/400x200/333/fff",

      targeting: {
        type: "SEGMENT",

        segments: ["LOYAL_CUSTOMER"],
      },

      validFrom: now,
      validUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),

      displayOrder: 4,
      featured: true,
      priority: 9,

      status: "ACTIVE",
    },

    /* =====================================================
       PRODUCT BASED PROMOTION
    ===================================================== */
    {
      title: "Apple Product Bonanza",
      description: "Special discounts on Apple devices.",

      shortDescription: "Apple Days",

      bannerImage: "https://dummyimage.com/1200x500/444/fff",
      thumbnailImage: "https://dummyimage.com/400x200/444/fff",

      targeting: {
        type: "PRODUCT_BASED",

        products: products[1]?._id ? [products[1]._id] : [],

        categories: ["mobile"],

        brands: ["Apple"],
      },

      validFrom: now,
      validUntil: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000),

      displayOrder: 5,
      featured: true,
      priority: 10,

      status: "ACTIVE",
    },
  ]);

  console.log(`✅ ${promotions.length} promotions seeded`);

  return promotions;
};

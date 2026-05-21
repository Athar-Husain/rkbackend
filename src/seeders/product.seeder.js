import Product from "../models/Product.model.js";

export const seedProducts = async (stores) => {
  console.log("📦 Seeding products...");

  await Product.deleteMany();

  const products = await Product.create([
    {
      sku: "SAMSUNG-TV-001",
      name: "Samsung 55 Inch Smart TV",
      category: "television",
      subcategory: "smart-tv",
      brand: "Samsung",
      model: "UA55DU7700",

      description: "4K UHD Smart Television with HDR support",
      highlights: [
        "4K UHD Display",
        "HDR10+",
        "Voice Assistant",
      ],

      images: [
        {
          url: "https://dummyimage.com/600x400/000/fff",
          alt: "Samsung Smart TV",
          isPrimary: true,
        },
      ],

      specifications: {
        screenSize: "55 inch",
        resolution: "3840x2160",
        os: "Tizen",
      },

      mrp: 65000,
      sellingPrice: 58999,

      availableInStores: [
        {
          storeId: stores[0]._id,
          stock: 5,
          lastUpdated: new Date(),
        },
        {
          storeId: stores[1]._id,
          stock: 2,
          lastUpdated: new Date(),
        },
      ],

      isFeatured: true,
      isBestSeller: true,
      keywords: ["tv", "samsung", "smart tv", "4k"],
    },

    {
      sku: "APPLE-IPHONE-001",
      name: "iPhone 15",
      category: "mobile",
      subcategory: "smartphone",
      brand: "Apple",
      model: "iPhone 15",

      description: "Latest Apple smartphone with A16 chip",
      highlights: [
        "Dynamic Island",
        "48MP Camera",
        "USB-C",
      ],

      images: [
        {
          url: "https://dummyimage.com/600x400/111/fff",
          alt: "iPhone 15",
          isPrimary: true,
        },
      ],

      specifications: {
        storage: "128GB",
        color: "Black",
        display: "6.1 inch OLED",
      },

      mrp: 79900,
      sellingPrice: 74900,

      availableInStores: [
        {
          storeId: stores[0]._id,
          stock: 10,
          lastUpdated: new Date(),
        },
      ],

      isFeatured: true,
      isNewArrival: true,
      keywords: ["iphone", "apple", "mobile"],
    },

    {
      sku: "SONY-AC-001",
      name: "Sony Air Conditioner",
      category: "appliances",
      subcategory: "air-conditioner",
      brand: "Sony",
      model: "SONY-AC-1.5T",

      description: "1.5 Ton Inverter AC",
      highlights: [
        "Inverter Compressor",
        "5 Star Rating",
        "Fast Cooling",
      ],

      images: [
        {
          url: "https://dummyimage.com/600x400/222/fff",
          alt: "Sony AC",
          isPrimary: true,
        },
      ],

      specifications: {
        tonnage: "1.5 Ton",
        energyRating: "5 Star",
      },

      mrp: 48000,
      sellingPrice: 42999,

      availableInStores: [
        {
          storeId: stores[2]._id,
          stock: 4,
          lastUpdated: new Date(),
        },
      ],

      isBestSeller: true,
      keywords: ["ac", "air conditioner", "sony"],
    },
  ]);

  console.log(`✅ ${products.length} products seeded`);

  return products;
};
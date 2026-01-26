import Product from "../models/Product.model.js";

export const seedProducts = async (stores) => {
  await Product.deleteMany();

  const products = await Product.insertMany([
    {
      sku: "IP14PM",
      name: "iPhone 14 Pro Max",
      category: "MOBILE",
      brand: "Apple",
      model: "14 Pro Max",
      mrp: 139999,
      sellingPrice: 129999,
      availableInStores: [
        {
          storeId: stores[0]._id,
          stock: 10,
        },
      ],
    },
  ]);

  console.log("✅ Products seeded");
  return products;
};

import Purchase from "../models/Purchase.model.js";

export const seedPurchases = async (users, stores, products) => {
  await Purchase.deleteMany();

  await Purchase.create({
    userId: users[0]._id,
    storeId: stores[0]._id,
    items: [
      {
        productId: products[0]._id,
        quantity: 1,
        unitPrice: products[0].sellingPrice,
        totalPrice: products[0].sellingPrice,
      },
    ],
    subtotal: products[0].sellingPrice,
    finalAmount: products[0].sellingPrice,
    invoiceNumber: "RKINV001",
  });

  console.log("✅ Purchases seeded");
};

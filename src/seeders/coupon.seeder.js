import Coupon from "../models/Coupon.model.js";

export const seedCoupons = async () => {
  await Coupon.deleteMany();

  const coupons = await Coupon.create([
    {
      code: "WELCOME100",
      title: "Welcome Offer",
      description: "Flat ₹100 off",
      type: "FIXED_AMOUNT",
      value: 100,
      minPurchaseAmount: 500,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
    },
  ]);

  console.log("✅ Coupons seeded");
  return coupons;
};

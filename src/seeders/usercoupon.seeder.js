import UserCoupon from "../models/UserCoupon.model.js";

export const seedUserCoupons = async (users, coupons) => {
  await UserCoupon.deleteMany();

  await UserCoupon.create({
    userId: users[0]._id,
    couponId: coupons[0]._id,
    validFrom: coupons[0].validFrom,
    validUntil: coupons[0].validUntil,
  });

  console.log("✅ UserCoupons seeded");
};

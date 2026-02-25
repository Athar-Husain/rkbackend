export class CouponEngine {
  constructor({ user, cart, coupons }) {
    this.user = user;
    this.cart = cart;
    this.coupons = coupons;
  }

  async evaluate() {
    const eligible = [];

    for (const coupon of this.coupons) {
      const result = await this.checkEligibility(coupon);
      if (result.eligible) {
        eligible.push(coupon);
      }
    }

    return eligible;
  }

  async checkEligibility(coupon) {
    // 1. Status
    if (!coupon.isActive) return { eligible: false };

    // 2. Per user usage
    // 3. Segment check
    // 4. Geographic check
    // 5. Purchase history check
    // 6. Product rules check

    return { eligible: true };
  }
}

export const checkCouponEligibility = ({ coupon, userSegments }) => {
  const now = new Date();

  if (coupon.status !== "ACTIVE") return false;

  if (coupon.validFrom && now < coupon.validFrom) return false;
  if (coupon.validUntil && now > coupon.validUntil) return false;

  if (
    coupon.maxRedemptions > 0 &&
    coupon.currentRedemptions >= coupon.maxRedemptions
  )
    return false;

  if (
    coupon.segments?.length &&
    !coupon.segments.some((s) => userSegments.includes(s))
  )
    return false;

  return true;
};

export const applyCouponsToAmount = (amount, coupons) => {
  let runningTotal = amount;
  let totalDiscount = 0;

  coupons.forEach((coupon) => {
    let discount = 0;

    if (coupon.type === "PERCENTAGE") {
      discount = (runningTotal * coupon.value) / 100;
      if (coupon.maxDiscount) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    } else {
      discount = coupon.value;
    }

    runningTotal -= discount;
    totalDiscount += discount;
  });

  return {
    finalAmount: Math.max(0, runningTotal),
    totalDiscount,
  };
};

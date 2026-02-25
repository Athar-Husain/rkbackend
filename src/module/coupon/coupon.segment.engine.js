export const evaluateSegments = (userStats) => {
  const segments = [];

  if (userStats.purchaseCount === 0) {
    segments.push("NEW_USER");
  }

  if (userStats.purchaseCount > 10) {
    segments.push("LOYAL_CUSTOMER");
  }

  if (userStats.lastPurchase) {
    const days = (Date.now() - new Date(userStats.lastPurchase)) / 86400000;

    if (days > 30) {
      segments.push("INACTIVE_30_DAYS");
    }
  }

  return segments;
};

export const resolveStacking = (coupons) => {
  const exclusive = coupons.find((c) => c.isExclusive);
  if (exclusive) return [exclusive];

  const grouped = {};

  coupons.forEach((c) => {
    const group = c.stacking?.stackGroup || "DEFAULT";
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(c);
  });

  const finalCoupons = [];

  Object.values(grouped).forEach((group) => {
    const sorted = group.sort(
      (a, b) => b.stacking.priority - a.stacking.priority,
    );
    finalCoupons.push(sorted[0]);
  });

  return finalCoupons;
};

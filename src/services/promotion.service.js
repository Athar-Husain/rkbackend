import Promotion from "../models/Promotion.model.js";
import { buildTargetingConditions } from "./targeting.service.js";

export const getActivePromotions = async ({
  featured = false,
  limit = 20,
  ...options
}) => {
  const now = new Date();

  const baseQuery = {
    status: "ACTIVE",
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    $expr: { $lt: ["$currentRedemptions", "$maxRedemptions"] },
  };

  if (featured) baseQuery.featured = true;

  const targetingConditions = buildTargetingConditions(options);

  return Promotion.find({
    ...baseQuery,
    $or: targetingConditions,
  })
    .sort({ priority: -1, displayOrder: 1, createdAt: -1 })
    .limit(limit);
};

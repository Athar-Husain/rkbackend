import Banner from "../models/Banner.model.js";
import { buildTargetingConditions } from "./targeting.service.js";

export const getActiveBanners = async (options = {}) => {
  const now = new Date();

  const baseQuery = {
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  };

  const targetingConditions = buildTargetingConditions(options);

  return Banner.find({
    ...baseQuery,
    $or: targetingConditions,
  }).sort({ displayOrder: 1, createdAt: -1 });
};

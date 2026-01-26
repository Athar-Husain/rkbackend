import asyncHandler from "express-async-handler";
import User from "../models/User.model.js";
import Purchase from "../models/Purchase.model.js";
import { sendBulkNotifications } from "../services/notification.service.js";

export const broadcastNotification = asyncHandler(async (req, res) => {
  const { title, body, target, cities, areas, userIds, data } = req.body;

  if (!title || !body) {
    return res
      .status(400)
      .json({ success: false, message: "Title and Body are required" });
  }

  let query = { isActive: true };

  // RK Electronics Targeting Logic
  switch (target) {
    case "CITY":
      query.city = { $in: cities.map((c) => c.toUpperCase().trim()) };
      break;
    case "AREA":
      // Matches "JAGRUTI-NAGAR" style
      query.area = {
        $in: areas.map((a) => a.toUpperCase().trim().replace(/\s+/g, "-")),
      };
      break;
    case "PURCHASE_HISTORY":
      // Targets anyone who has made a purchase
      query._id = { $in: await Purchase.distinct("userId") };
      break;
    case "SPECIFIC":
      query._id = { $in: userIds };
      break;
    default:
      // Default targets everyone
      break;
  }

  const users = await User.find(query).select("_id");

  if (!users.length) {
    return res
      .status(404)
      .json({ success: false, message: "No users found for this target" });
  }

  const result = await sendBulkNotifications(
    users.map((u) => u._id),
    title,
    body,
    "PUSH",
    data,
  );

  res.status(200).json({
    success: true,
    message: `Notification sent to ${result.success} users`,
    stats: result,
  });
});

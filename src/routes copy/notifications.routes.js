import express from "express";
// import { protect } from "../middleware/protect.js";
import { AllProtect } from "../middleware/auth.js";
import {
  getMyNotifications,
  markNotificationsAsRead,
} from "../controllers/notificationController.js";
// import {
//   getMyNotifications,
//   markNotificationsAsRead,
// } from "../controllers/notification.controller.js";

const router = express.Router();

// Get logged-in user's notifications
router.get("/myNotifications", AllProtect, getMyNotifications);

// Mark notifications as read
router.patch("/read", AllProtect, markNotificationsAsRead);
export default router;

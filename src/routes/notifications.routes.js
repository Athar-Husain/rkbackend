import express from "express";
import { AllProtect } from "../middleware/auth.js";
import {
  getMyNotifications,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
} from "../controllers/notificationController.js";

const router = express.Router();

// ===============================
// GET MY NOTIFICATIONS
// ===============================
router.get("/my-notifications", AllProtect, getMyNotifications);

// ===============================
// MARK SELECTED NOTIFICATIONS AS READ
// ===============================
router.patch("/read", AllProtect, markNotificationsAsRead);

// ===============================
// MARK ALL NOTIFICATIONS AS READ
// ===============================
router.patch("/read-all", AllProtect, markAllNotificationsAsRead);

export default router;
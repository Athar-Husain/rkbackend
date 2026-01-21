import express from "express";
const router = express.Router();

import { adminProtect } from "../middleware/auth.js";
import {
  getSalesAnalytics,
  getUserAnalytics,
  getCouponAnalytics,
  getStoreAnalytics,
} from "../controllers/analyticsController.js";

// All routes require admin authentication
router.use(adminProtect);

router.get("/sales", getSalesAnalytics);
// router.get("/sales", analyticsController.getSalesAnalytics);
router.get("/users", getUserAnalytics);
router.get("/coupons", getCouponAnalytics);
router.get("/stores", getStoreAnalytics);

// ES6 Default Export
export default router;

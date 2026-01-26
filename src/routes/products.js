import express from "express";
import {
  addProduct,
  checkAvailability,
  compareProducts,
  getFeaturedProducts,
  getProductById,
  getProducts,
  getProductsByCategory,
  searchProducts,
  updateProduct,
} from "../controllers/productController.js";
import { adminProtect } from "../middleware/auth.js";
const router = express.Router();

// Public routes
router.get("/getProducts", getProducts);
router.get("/getFeaturedProducts", getFeaturedProducts);
router.get("/search/:query", searchProducts);
router.get("/category/:category", getProductsByCategory);
router.get("/getProductById/:id", getProductById);
router.get("/checkAvailability/:id/availability", checkAvailability);
router.post("/compare", compareProducts);

router.post("/addproduct", adminProtect, addProduct);
router.patch("/updateProduct/:id", adminProtect, updateProduct);

export default router;

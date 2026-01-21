const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");

// Public routes
router.get("/", productController.getProducts);
router.get("/featured", productController.getFeaturedProducts);
router.get("/search/:query", productController.searchProducts);
router.get("/category/:category", productController.getProductsByCategory);
router.get("/:id", productController.getProductById);
router.get("/:id/availability", productController.checkAvailability);
router.post("/compare", productController.compareProducts);

module.exports = router;

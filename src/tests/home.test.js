import request from "supertest";
import app from "../app.js";

describe("Home Routes", () => {
  describe("GET /api/home/dashboard", () => {
    it("should return home dashboard data", async () => {
      const response = await request(app).get("/api/home/dashboard");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.dashboard).toBeDefined();
      expect(response.body.dashboard.banners).toBeDefined();
      expect(response.body.dashboard.featuredPromotions).toBeDefined();
      expect(response.body.dashboard.trendingProducts).toBeDefined();
      expect(response.body.dashboard.quickAccess).toBeDefined();
    });
  });

  describe("GET /api/home/banners", () => {
    it("should return banners", async () => {
      const response = await request(app).get("/api/home/banners");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.banners).toBeDefined();
    });
  });

  describe("GET /api/home/promotions", () => {
    it("should return promotions", async () => {
      const response = await request(app).get("/api/home/promotions");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.promotions).toBeDefined();
    });
  });

  describe("GET /api/home/featured-products", () => {
    it("should return featured products", async () => {
      const response = await request(app).get("/api/home/featured-products");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.products).toBeDefined();
    });
  });

  describe("GET /api/home/quick-access", () => {
    it("should return quick access tiles", async () => {
      const response = await request(app).get("/api/home/quick-access");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.quickAccess).toBeDefined();
    });
  });

  describe("GET /api/home/search-offers", () => {
    it("should return search results", async () => {
      const response = await request(app).get("/api/home/search-offers?q=test");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.banners).toBeDefined();
      expect(response.body.promotions).toBeDefined();
    });
  });
});
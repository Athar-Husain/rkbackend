import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    /* ------------------ Basic Info ------------------ */
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    subcategory: String,
    brand: {
      type: String,
      required: true,
      index: true,
    },
    model: {
      type: String,
      required: true,
    },

    /* ------------------ Description ------------------ */
    description: String,
    highlights: [String],

    /* ------------------ Media ------------------ */
    images: [
      {
        url: String,
        alt: String,
        isPrimary: { type: Boolean, default: false },
      },
    ],

    /* ------------------ Specifications ------------------ */
    specifications: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },

    /* ------------------ Pricing ------------------ */
    mrp: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },

    /* ------------------ Inventory ------------------ */
    availableInStores: [
      {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
        stock: { type: Number, default: 0 },
        lastUpdated: Date,
      },
    ],
    overallStock: { type: Number, default: 0 },

    /* ------------------ Attributes ------------------ */
    isFeatured: { type: Boolean, default: false, index: true },
    isNewArrival: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 0, index: true },

    /* ------------------ Metadata ------------------ */
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    keywords: [String],
    slug: { type: String, unique: true, lowercase: true, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/* =====================================================
   PRE-SAVE HOOK
===================================================== */

productSchema.pre("save", function () {
  // Generate slug
  if (!this.slug) {
    this.slug = `${this.brand}-${this.model}-${this.sku}`
      .replace(/\s+/g, "-")
      .toLowerCase();
  }

  // Safe discount calculation
  const mrp = this.mrp ?? 0;
  const selling = this.sellingPrice ?? 0;

  if (mrp > 0 && selling >= 0) {
    this.discountPercentage = Math.max(
      0,
      Math.round(((mrp - selling) / mrp) * 100),
    );
  }

  // Calculate overall stock
  if (Array.isArray(this.availableInStores)) {
    this.overallStock = this.availableInStores.reduce(
      (total, store) => total + (store.stock || 0),
      0,
    );
  }
});

/* =====================================================
   SAFE VIRTUALS (NEVER CRASH)
===================================================== */

productSchema.virtual("formattedMRP").get(function () {
  const mrp = this.mrp ?? 0;
  return `₹${Number(mrp).toLocaleString("en-IN")}`;
});

productSchema.virtual("formattedSellingPrice").get(function () {
  const price = this.sellingPrice ?? 0;
  return `₹${Number(price).toLocaleString("en-IN")}`;
});

productSchema.virtual("formattedSavings").get(function () {
  const mrp = this.mrp ?? 0;
  const price = this.sellingPrice ?? 0;
  return `₹${(mrp - price).toLocaleString("en-IN")}`;
});

/* =====================================================
   INDEXES
===================================================== */

productSchema.index({ name: "text", brand: "text", category: "text" });

const Product = mongoose.model("Product", productSchema);
export default Product;

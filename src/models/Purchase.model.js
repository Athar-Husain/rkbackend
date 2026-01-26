import mongoose from "mongoose";

const purchaseSchema = new mongoose.Schema(
  {
    // Customer Information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Store Information
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    staffId: String,

    // Items Purchased
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        sku: String,
        name: String,
        category: String,
        brand: String,
        model: String,
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        unitPrice: {
          type: Number,
          required: true,
          min: 0,
        },
        totalPrice: {
          type: Number,
          min: 0,
        },
        specifications: {
          type: Map,
          of: mongoose.Schema.Types.Mixed,
        },
      },
    ],

    // Pricing
    subtotal: {
      type: Number,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalAmount: {
      type: Number,
      min: 0,
    },

    // Coupon Used
    couponUsed: {
      userCouponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserCoupon",
      },
      couponCode: String,
      discountApplied: Number,
    },

    // Payment Information
    payment: {
      method: {
        type: String,
        enum: ["CASH", "CARD", "UPI", "CHEQUE", "EMI", "WALLET"],
        default: "CASH",
      },
      transactionId: String,
      status: {
        type: String,
        enum: ["PENDING", "COMPLETED", "FAILED"],
        default: "COMPLETED",
      },
      notes: String,
    },

    // Invoice Details
    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
    },

    // Delivery / Installation
    delivery: {
      type: {
        type: String,
        enum: ["STORE_PICKUP", "HOME_DELIVERY"],
        default: "STORE_PICKUP",
      },
      address: String,
      scheduledDate: Date,
      status: {
        type: String,
        enum: ["PENDING", "SCHEDULED", "DELIVERED", "INSTALLED"],
        default: "PENDING",
      },
      installationRequired: {
        type: Boolean,
        default: false,
      },
    },

    // Warranty Information
    warranty: {
      period: String,
      startDate: Date,
      endDate: Date,
      cardNumber: String,
    },

    // Status
    status: {
      type: String,
      enum: ["DRAFT", "COMPLETED", "CANCELLED", "REFUNDED"],
      default: "COMPLETED",
    },

    // Customer Feedback
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/* =========================
   PRE SAVE (NO next())
========================= */
purchaseSchema.pre("save", async function () {
  /* ---------- INVOICE NUMBER ---------- */
  if (!this.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const random = Math.floor(1000 + Math.random() * 9000);
    this.invoiceNumber = `RKINV${year}${month}${random}`;
  }

  /* ---------- ITEM TOTALS ---------- */
  if (this.items && this.items.length > 0) {
    this.items.forEach((item) => {
      if (!item.totalPrice) {
        item.totalPrice = item.unitPrice * item.quantity;
      }
    });

    /* ---------- SUBTOTAL ---------- */
    if (this.subtotal == null) {
      this.subtotal = this.items.reduce(
        (sum, item) => sum + item.totalPrice,
        0,
      );
    }

    /* ---------- FINAL AMOUNT ---------- */
    if (this.finalAmount == null) {
      this.finalAmount = this.subtotal - (this.discount || 0) + (this.tax || 0);
    }
  }
});

/* =========================
   VIRTUALS
========================= */
purchaseSchema.virtual("formattedSubtotal").get(function () {
  return `₹${this.subtotal?.toLocaleString("en-IN") ?? 0}`;
});

purchaseSchema.virtual("formattedDiscount").get(function () {
  return `₹${this.discount?.toLocaleString("en-IN") ?? 0}`;
});

purchaseSchema.virtual("formattedFinalAmount").get(function () {
  return `₹${this.finalAmount?.toLocaleString("en-IN") ?? 0}`;
});

purchaseSchema.virtual("savingsPercentage").get(function () {
  if (!this.subtotal) return 0;
  return Math.round((this.discount / this.subtotal) * 100);
});

/* =========================
   METHODS
========================= */
purchaseSchema.methods.addItem = async function (
  productId,
  quantity,
  unitPrice,
) {
  const Product = mongoose.model("Product");
  const product = await Product.findById(productId);

  if (!product) {
    throw new Error("Product not found");
  }

  this.items.push({
    productId: product._id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    brand: product.brand,
    model: product.model,
    quantity,
    unitPrice,
    totalPrice: unitPrice * quantity,
    specifications: product.specifications,
  });

  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);

  this.finalAmount = this.subtotal - (this.discount || 0) + (this.tax || 0);

  return this.save();
};

/* =========================
   STATICS
========================= */
purchaseSchema.statics.getUserHistory = function (userId, options = {}) {
  const query = { userId };

  if (options.startDate || options.endDate) {
    query.createdAt = {};
    if (options.startDate) query.createdAt.$gte = new Date(options.startDate);
    if (options.endDate) query.createdAt.$lte = new Date(options.endDate);
  }

  if (options.storeId) {
    query.storeId = options.storeId;
  }

  return this.find(query)
    .populate("storeId", "name location.address location.city location.area")
    .populate("items.productId", "name category brand model images")
    .sort({ createdAt: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 20);
};

purchaseSchema.statics.getStoreReport = function (storeId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        storeId: new mongoose.Types.ObjectId(storeId),
        status: "COMPLETED",
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        },
        totalSales: { $sum: "$finalAmount" },
        totalDiscounts: { $sum: "$discount" },
        transactionCount: { $sum: 1 },
        averageTransaction: { $avg: "$finalAmount" },
      },
    },
    { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } },
  ]);
};

const Purchase = mongoose.model("Purchase", purchaseSchema);
export default Purchase;

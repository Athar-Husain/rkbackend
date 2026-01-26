import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const staffSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Staff name is required"],
      trim: true,
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false, // Prevents password from leaking in API responses
    },
    userType: {
      type: String,
      lowercase: true,
      default: "admin",
    },
    role: {
      type: String,
      //   enum: ["STAFF", "MANAGER", "ADMIN"],
      lowercase: true,
      default: "staff",
    },
    permissions: {
      canVerifyCoupon: { type: Boolean, default: true },
      canRedeemCoupon: { type: Boolean, default: true },
      canCreatePurchase: { type: Boolean, default: true },
      canViewBranchReports: { type: Boolean, default: false },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: Date,
  },
  { timestamps: true },
);

/**
 * 🔐 MODERN ASYNC PASSWORD HASHING
 */
staffSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * 🔑 AUTHENTICATION METHOD
 */
staffSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Staff = mongoose.model("Staff", staffSchema);
export default Staff;

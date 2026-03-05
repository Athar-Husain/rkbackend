import dotenv from "dotenv";
import mongoose from "mongoose";
import NotificationLog from "./models/NotificationLog.model.js";

dotenv.config();

const fixNotificationLogs = async () => {
  try {
    console.log("\n=========================================");
    console.log("🚀  NOTIFICATION DATA TYPE FIX STARTING");
    console.log("=========================================\n");

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB successfully.\n");

    // 1. Find all logs where userId is stored as a string
    // In MongoDB, { $type: 2 } represents the String type
    const logsToFix = await NotificationLog.find({ 
        userId: { $type: "string" } 
    });

    let totalChecked = logsToFix.length;
    let fixedCount = 0;
    let errorCount = 0;

    console.log(`🔍 Found ${totalChecked} notifications with String IDs. Fixing...\n`);

    for (const log of logsToFix) {
      try {
        // Convert the string userId to a proper ObjectId
        const stringId = log.userId;
        
        // Check if it's a valid hex string before converting
        if (mongoose.Types.ObjectId.isValid(stringId)) {
          log.userId = new mongoose.Types.ObjectId(stringId);
          
          // Optional: Force userModel to "User" if it's lowercase or missing
          // This ensures your getMyNotifications query matches
          if (log.userModel === "user") {
              log.userModel = "User";
          }

          await log.save();
          fixedCount++;
          
          if (fixedCount % 50 === 0) {
              console.log(` progress: fixed ${fixedCount} logs...`);
          }
        } else {
          console.log(`⚠️  SKIPPING [${log._id}]: Invalid ID string "${stringId}"`);
          errorCount++;
        }
      } catch (err) {
        console.error(`❌ Error updating log ${log._id}:`, err.message);
        errorCount++;
      }
    }

    // FINAL REPORT
    console.log("\n=========================================");
    console.log("📊  FINAL REPAIR REPORT");
    console.log("=========================================");
    console.table({
      "Total Logs Needing Fix": totalChecked,
      "Successfully Converted": fixedCount,
      "Errors / Invalid IDs": errorCount,
    });
    console.log("=========================================\n");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ CRITICAL ERROR:", error);
    process.exit(1);
  }
};

fixNotificationLogs();
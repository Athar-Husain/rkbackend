import NotificationLog from "../models/NotificationLog.model.js";

export const seedNotificationLogs = async (users) => {
  await NotificationLog.deleteMany();

  await NotificationLog.create({
    userId: users[0]._id,
    type: "PUSH",
    title: "Welcome!",
    content: "Thanks for registering with RK Electronics",
  });

  console.log("✅ NotificationLogs seeded");
};

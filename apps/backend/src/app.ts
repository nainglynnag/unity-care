import express from "express";
import cors from "cors";

// Routes
import authRoutes from "./routes/auth.routes";
import incidentRoutes from "./routes/incident.routes";
import emergencyProfileRoutes from "./routes/emergencyProfile.route";
import volunteerApplicationRoutes from "./routes/volunteerApplication.route";
import volunteerProfileRoutes from "./routes/volunteerProfile.route";
import missionRoutes from "./routes/mission.routes";
import accountRoutes from "./routes/account.routes";
import userRoutes from "./routes/users.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import skillRoutes from "./routes/skill.routes";
import categoryRoutes from "./routes/category.routes";
import agencyRoutes from "./routes/agency.routes";
import notificationRoutes from "./routes/notification.routes";
import { errorHandler } from "./middlewares/error.middleware";
import { globalLimiter } from "./middlewares/rateLimit";
import { scheduleTokenCleanup } from "./jobs/tokenCleanup";
import { scheduleNotificationCleanup } from "./jobs/notificationCleanup";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limit — 200 req / 15 min / IP.
// Applied before routes as a broad safety net for any route without a specific limiter.
app.use(globalLimiter);

app.get("/api/v1/hello", (req, res) => {
  res.json({ message: "Hello from the backend!" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/incidents", incidentRoutes);
app.use("/api/v1/emergency-profiles", emergencyProfileRoutes);
app.use("/api/v1/applications", volunteerApplicationRoutes);
app.use("/api/v1/volunteer-profiles", volunteerProfileRoutes);
app.use("/api/v1/missions", missionRoutes);
app.use("/api/v1/account", accountRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/skills", skillRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/agencies", agencyRoutes);
app.use("/api/v1/notifications", notificationRoutes);

app.use(errorHandler);

// Start background jobs
scheduleTokenCleanup();
scheduleNotificationCleanup();

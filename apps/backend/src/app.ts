import express from "express";
import cors from "cors";

// Routes
import authRoutes from "./routes/auth.routes";
import incidentRoutes from "./routes/incident.routes";
import { errorHandler } from "./middlewares/error.middleware";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/v1/hello", (req, res) => {
  res.json({ message: "Hello from the backend!" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/incidents", incidentRoutes);

app.use(errorHandler);

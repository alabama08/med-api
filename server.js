import "./config/env.js"; // ← must be first, before everything else

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import { validateEnv } from "./utils/validateEnv.js";

import authRoutes         from "./routes/authRoutes.js";
import doctorRoutes       from "./routes/doctorRoutes.js";
import appointmentRoutes  from "./routes/appointmentRoutes.js";
import paymentRoutes      from "./routes/paymentRoutes.js";
import prescriptionRoutes from "./routes/prescriptionRoutes.js";
import messageRoutes      from "./routes/messageRoutes.js";
import reviewRoutes       from "./routes/reviewRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminRoutes        from "./routes/adminRoutes.js";
import contentRoutes      from "./routes/contentRoutes.js";
import uploadRouter       from "./routes/uploadRoute.js";
import careerRoutes       from "./routes/careerRoutes.js";

import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { initSocket } from "./socket/chatSocket.js";

validateEnv();
connectDB();

const app        = express();
const httpServer = createServer(app);

const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://medbook-client.vercel.app",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials:    true,
  methods:        ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

const io = new Server(httpServer, {
  cors: {
    origin:      allowedOrigins,
    methods:     ["GET", "POST"],
    credentials: true,
  },
});

initSocket(io);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(morgan("dev"));
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

app.use("/api/auth",          authRoutes);
app.use("/api/doctors",       doctorRoutes);
app.use("/api/appointments",  appointmentRoutes);
app.use("/api/payments",      paymentRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/messages",      messageRoutes);
app.use("/api/reviews",       reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin",         adminRoutes);
app.use("/api/content",       contentRoutes);
app.use("/api/upload",        uploadRouter);
app.use("/api/careers",       careerRoutes);

app.get("/", (req, res) => res.send("🏥 MedBook API is running..."));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
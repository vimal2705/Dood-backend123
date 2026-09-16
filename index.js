require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const dreamRoutes = require("./routes/dreamRoutes");
const actionRoutes = require("./routes/actionRoutes");
const taskRoutes = require("./routes/taskRoutes");
const ideaRoutes = require("./routes/ideaRoutes");
const noteRoutes = require("./routes/noteRoutes");
const moneyRoutes = require("./routes/moneyRoutes");
const aiRoutes = require("./routes/aiRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const productivityRoutes = require("./routes/productivityRoutes");
const focusRoutes = require("./routes/focusRoutes");
const challengeRoutes = require("./routes/challengeRoutes");

// Initialize app
const app = express();

// Reverse proxy (Railway/Render/etc.) sets X-Forwarded-For.
// Trust only the first hop so rate-limit can key by client IP.
app.set("trust proxy", 1);

// Connect to database
connectDB();

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "production" ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, try again later" },
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "production" ? 30 : 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Mentor is busy. Try again in a few minutes." },
});

// Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      if (
        process.env.NODE_ENV !== "production" ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  }),
);

// Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/dreams", dreamRoutes);
app.use("/api/actions", actionRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/ideas", ideaRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/money", moneyRoutes);
app.use("/api/ai", aiLimiter, aiRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/review", reviewRoutes);
app.use("/api/productivity", productivityRoutes);
app.use("/api/focus-sessions", focusRoutes);
app.use("/api/challenges", challengeRoutes);

// Health check route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Dood Backend API" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, message: "Image is too large (max 6MB)" });
  }
  if (err?.message === "Only image files are allowed") {
    return res.status(400).json({ success: false, message: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Something went wrong" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

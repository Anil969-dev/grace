require("dotenv").config();

const express = require("express");
const connectDB = require("./db/connect");
const cors = require("cors");
const http = require("http");
const socketService = require("./services/socketService");
const chatBotService = require("./services/chatBotService");

// Route Imports
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const donationRoutes = require("./routes/donationRoutes");
const impactStoryRoutes = require("./routes/impactStoryRoutes");
const ngoRoutes = require("./routes/ngoRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const skillSurveyRoutes = require("./routes/skillSurveyRoutes");
const taskRoutes = require("./routes/taskRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const chatBotRoutes = require("./routes/chatBotRoutes");
const quizRoutes = require("./routes/quizRoutes");
const ngoRecommendationRoutes = require("./routes/ngoRecommendationRoutes");
const graceFeedRoutes = require("./routes/GraceFeedRoutes");
const marketplaceRoutes = require("./routes/marketplaceRoutes");
const articleRoutes = require("./routes/articleRoutes");
const ngoReportRoutes = require("./routes/ngoReportRoutes");
const adminRoutes = require("./routes/adminRoutes");
const volunteerApplicationRoutes = require("./routes/volunteerApplicationRoutes");

const app = express();

// Middleware Configuration
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dynamic CORS Configuration
const corsOrigins = (
  process.env.CORS_ORIGINS ||
  process.env.CLIENT_URL ||
  process.env.CORS_ORIGIN ||
  "http://localhost:3000"
)
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

const allowsAllOrigins = corsOrigins.includes("*");
console.log("Allowed CORS Origins:", corsOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps) or if it matches our list
      if (!origin || allowsAllOrigins || corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS Blocked for origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  })
);

// Handle pre-flight across all routes
app.options("*", cors());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/articles", articleRoutes);
app.use("/api/ngosRecommendations", ngoRecommendationRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/chatbot", chatBotRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/feed", graceFeedRoutes);
app.use("/api/impact-stories", impactStoryRoutes);
app.use("/api/ngos", ngoRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/skill-surveys", skillSurveyRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/users", userRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/ngo-reports", ngoReportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/volunteer-applications", volunteerApplicationRoutes);

// Basic Health Check
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is working!" });
});

// Global Error Handler (Must be placed AFTER routes)
app.use((err, req, res, next) => {
  console.error("❌ BACKEND ERROR:", {
    message: err.message,
    origin: req.headers.origin,
    path: req.path,
  });

  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});

// Server Initialization
async function run() {
  try {
    // 1. Connect to Database
    await connectDB();
    console.log("✅ Connected to MongoDB");

    // 2. Initialize Chatbot Service
    await chatBotService.initializeVectorStore();
    console.log("✅ Chatbot vector store initialized");

    // 3. Create HTTP Server for Sockets
    const server = http.createServer(app);
    
    // 4. Initialize Sockets
    const socketAllowedOrigins = allowsAllOrigins ? ["*"] : corsOrigins;
    socketService.init(server, { allowedOrigins: socketAllowedOrigins });
    console.log("✅ Socket service initialized");

    // 5. Start Listening
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("💥 Failed to start server:", error);
    process.exit(1);
  }
}

run();

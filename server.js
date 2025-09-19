import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";

const app = express();

// Restrict CORS to your site and local dev
const allowedOrigins = [
"https://globalharvest.netlify.app", // your Netlify site
"http://localhost:5500", // VS Code Live Server
"http://127.0.0.1:5500"
];

app.use(
cors({
origin: (origin, cb) => {
// Allow server-to-server/no-origin and allowed sites
if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
return cb(new Error("Not allowed by CORS"));
}
})
);

app.use(express.json());

// Simple routes
app.get("/", (req, res) => {
res.send("Global Harvest API is running");
});

app.get("/test", (req, res) => {
res.json({ ok: true, msg: "test route" });
});

app.get("/api/health", (req, res) => {
const state = mongoose.connection.readyState; // 0,1,2,3
res.json({
ok: true,
time: new Date().toISOString(),
dbConnected: state === 1,
dbState: state
});
});

// MongoDB
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "globalharvest";

if (mongoUri && mongoUri.trim() !== "") {
mongoose
.connect(mongoUri, { dbName })
.then(() => console.log("MongoDB connected"))
.catch((e) => console.error("MongoDB connection error:", e.message));
} else {
console.warn("No MONGODB_URI provided; skipping DB connection");
}

// Start
const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Server running on port " + port));
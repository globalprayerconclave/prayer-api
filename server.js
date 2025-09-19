import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";

const app = express();
import cors from "cors";

const allowedOrigins = [
"https://globalharvest.netlify.app", // your Netlify site
"http://localhost:5500", // local dev (VS Code Live Server)
"http://127.0.0.1:5500" // local dev (alternate)
];

app.use(
cors({
origin: (origin, cb) => {
// Allow server-to-server requests (no Origin) and the allowed sites
if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
return cb(new Error("Not allowed by CORS"));
},
methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
allowedHeaders: ["Content-Type", "Authorization"]
})
);

// Optional: clearer error if blocked by CORS
app.use((err, req, res, next) => {
if (err && err.message === "Not allowed by CORS") {
return res.status(403).json({ ok: false, error: "CORS: Origin not allowed" });
}
next(err);
});
app.use(express.json());

// Debug routes
app.get("/", (req, res) => {
res.send("Global Harvest API is running");
});

app.get("/test", (req, res) => {
res.json({ ok: true, msg: "test route" });
});

// Health route
app.get("/api/health", (req, res) => {
const state = mongoose.connection.readyState; // 0=disconnected,1=connected,2=connecting,3=disconnecting
res.json({
ok: true,
time: new Date().toISOString(),
dbConnected: state === 1,
dbState: state
});
});

// Mongo
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

// Start server
const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Server running on port " + port));
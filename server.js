import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";

const app = express();
app.use(cors());
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
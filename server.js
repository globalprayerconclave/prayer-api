import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";

const app = express();

// Restrict CORS to your site and local dev
const allowedOrigins = [
  "https://globalharvest.netlify.app", // your Netlify site
  "http://localhost:5500",             // VS Code Live Server
  "http://127.0.0.1:5500"
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server/no-origin (e.g., curl, direct browser URL) and allowed sites
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
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

// ------------------------------
// Prayer items (countries + topics)
// ------------------------------
const PrayerItemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["country", "topic"], required: true },
    name: { type: String, required: true, unique: true },

    // For countries
    flag: String,
    location: String,
    capital: String,
    population: String,
    headOfState: String,
    officialLanguage: String,
    languages: String,
    peopleGroups: String,
    leastReachedPeopleGroups: String,
    largestReligion: String,
    christianPopulation: String,

    // For topics
    icon: String,
    description: String,

    // Schedule
    dayOfWeek: {
      type: String,
      enum: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
      required: true
    },
    startTime: { type: String, required: true }, // "HH:mm"
    durationMinutes: { type: Number, default: 60 },
    region: String,

    // Prayer points
    prayerPoints: [
      {
        category: String,
        points: [String]
      }
    ]
  },
  { timestamps: true }
);

const PrayerItem = mongoose.model("PrayerItem", PrayerItemSchema);

// Get all items for the frontend
app.get("/api/items", async (req, res) => {
  try {
    const items = await PrayerItem.find({}).lean();
    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// One-time seed route: adds a sample country + a sample topic (idempotent)
app.get("/api/dev/seed", async (req, res) => {
  try {
    const samples = [
      {
        type: "country",
        name: "Kenya",
        flag: "https://flagcdn.com/w320/ke.png",
        location: "East Africa",
        capital: "Nairobi",
        population: "55 million",
        headOfState: "President William Ruto",
        officialLanguage: "Swahili, English",
        languages: "60+",
        peopleGroups: "110",
        leastReachedPeopleGroups: "—",
        largestReligion: "Christianity",
        christianPopulation: "85%",
        dayOfWeek: "Wednesday",
        startTime: "07:30",
        durationMinutes: 45,
        region: "East Africa",
        prayerPoints: [
          { category: "Current Concerns", points: ["Drought resilience", "Youth employment"] },
          { category: "Revival and Awakening", points: ["Church unity", "Bold witness"] }
        ]
      },
      {
        type: "topic",
        name: "Global Church Unity",
        icon: "✝️",
        description: "Praying for unity among Christian denominations worldwide",
        dayOfWeek: "Saturday",
        startTime: "23:30",
        durationMinutes: 60,
        region: "Global",
        prayerPoints: [
          {
            category: "Biblical Foundation",
            points: [
              "Pray for the fulfillment of John 17:21",
              "Break down denominational barriers"
            ]
          },
          {
            category: "Practical Steps",
            points: [
              "Joint worship and prayer gatherings",
              "Share resources and encourage reconciliation"
            ]
          }
        ]
      }
    ];

    let created = 0;
    for (const doc of samples) {
      const result = await PrayerItem.updateOne(
        { name: doc.name },
        { $setOnInsert: doc },
        { upsert: true }
      );
      // If newly inserted, some drivers expose upsertedId
      if (result.upsertedId) created += 1;
    }

    res.json({ ok: true, message: `Seed complete. Inserted new: ${created}` });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
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
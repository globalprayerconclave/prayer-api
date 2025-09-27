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
      if (result.upsertedId) created += 1;
    }

    res.json({ ok: true, message: `Seed complete. Inserted new: ${created}` });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ------------------------------
// Immediate Prayer Needs (Urgent Requests)
// ------------------------------
const LinkSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    url:  { type: String, required: true }
  },
  { _id: false }
);

const UrgentRequestSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
    prayerPoints:{ type: [String], default: [] },
    links:       { type: [LinkSchema], default: [] },
    region:      { type: String },
    active:      { type: Boolean, default: true },
    priority:    { type: Number, default: 0 } // higher shows first
  },
  { timestamps: true }
);

const UrgentRequest = mongoose.model("UrgentRequest", UrgentRequestSchema);

// GET /api/urgent?active=true|false|all&q=search&limit=20
app.get("/api/urgent", async (req, res) => {
  try {
    const { active = "true", q = "", limit = "20" } = req.query;

    const query = {};
    if (active !== "all") {
      query.active = active === "true";
    }
    if (q && String(q).trim().length > 0) {
      query.$or = [
        { title:       { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } }
      ];
    }

    const lim = Math.min(parseInt(limit || "20", 10) || 20, 100);

    const items = await UrgentRequest
      .find(query)
      .sort({ priority: -1, createdAt: -1 })
      .limit(lim)
      .lean();

    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/urgent/:id
app.get("/api/urgent/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const doc = await UrgentRequest.findById(id).lean();
    if (!doc) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, item: doc });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/urgent
app.post("/api/urgent", async (req, res) => {
  try {
    const { title, description } = req.body || {};
    if (!title || !description) {
      return res.status(400).json({ ok: false, error: "title and description are required" });
    }
    const payload = {
      title,
      description,
      prayerPoints: Array.isArray(req.body.prayerPoints) ? req.body.prayerPoints : [],
      links: Array.isArray(req.body.links) ? req.body.links : [],
      region: req.body.region || "",
      active: typeof req.body.active === "boolean" ? req.body.active : true,
      priority: typeof req.body.priority === "number" ? req.body.priority : 0
    };
    const doc = await UrgentRequest.create(payload);
    res.status(201).json({ ok: true, id: doc._id });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ ok: false, error: "An urgent request with this title already exists" });
    }
    res.status(500).json({ ok: false, error: e.message });
  }
});

// PATCH /api/urgent/:id
app.patch("/api/urgent/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const allowed = ["title","description","prayerPoints","links","region","active","priority"];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const doc = await UrgentRequest.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!doc) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, item: doc });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ ok: false, error: "An urgent request with this title already exists" });
    }
    res.status(500).json({ ok: false, error: e.message });
  }
});

// DELETE /api/urgent/:id
app.delete("/api/urgent/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const doc = await UrgentRequest.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, deleted: id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Optional: seed urgent items (idempotent)
app.get("/api/dev/urgent-seed", async (req, res) => {
  try {
    const samples = [
      {
        title: "Earthquake — Afghanistan",
        description: "A strong earthquake has affected communities. Pray for rescue teams, survivors, and relief efforts.",
        prayerPoints: [
          "Safety and effectiveness for rescue teams",
          "Comfort and healing for the injured and bereaved",
          "Adequate shelter, food, and medical supplies",
          "Wisdom for authorities and aid organizations",
          "Hope and spiritual comfort amidst devastation"
        ],
        links: [
          { text: "Watch: Earthquake Hits Afghanistan", url: "https://www.youtube.com/watch?v=FLriPFyEe4A" }
        ],
        region: "South Asia",
        active: true,
        priority: 10
      },
      {
        title: "Conflict / Displacement — Myanmar",
        description: "Rising conflict has displaced families. Pray for peace, protection, and humanitarian access.",
        prayerPoints: [
          "Immediate ceasefire and peaceful resolution",
          "Protection for civilians",
          "Humanitarian access for those in need",
          "Wisdom and compassion for leaders",
          "Reconciliation and healing in communities"
        ],
        links: [
          { text: "Read: Humanitarian Report", url: "https://example.com/conflict-update" }
        ],
        region: "Southeast Asia",
        active: true,
        priority: 8
      }
    ];

    let created = 0;
    for (const doc of samples) {
      const result = await UrgentRequest.updateOne(
        { title: doc.title },
        { $setOnInsert: doc },
        { upsert: true }
      );
      if (result.upsertedId) created += 1;
    }
    res.json({ ok: true, message: `Urgent seed complete. Inserted new: ${created}` });
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
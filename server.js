// ================= DNS FIX (Windows SRV Fix) =================
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

/* ================= CORS (MOBILE + NETLIFY SAFE) ================= */

// For student project allow all origins
app.use(cors());

app.use(express.json());

/* ================= DATABASE ================= */

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ Mongo Error:", err));

/* ================= MODELS ================= */

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: "student" }
});

const taskSchema = new mongoose.Schema({
  title: String,
  description: String,
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  status: {
    type: String,
    enum: ["not_started", "in_progress", "completed"],
    default: "not_started"
  },
  verified: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Task = mongoose.model("Task", taskSchema);

/* ================= AUTH MIDDLEWARE ================= */

const verifyToken = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: "No token" });

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

/* ================= AUTH ROUTES ================= */

// Register
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      password: hashed,
      role: "student"
    });

    res.json({ message: "Registered successfully" });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      role: user.role,
      name: user.name
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ================= ADMIN ROUTES ================= */

// Get all students
app.get("/students", verifyToken, async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Admin only" });

  const students = await User.find({ role: "student" });
  res.json(students);
});

// Create task
app.post("/tasks", verifyToken, async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Admin only" });

  const { title, description, assignedTo } = req.body;

  const task = await Task.create({
    title,
    description,
    assignedTo
  });

  res.json(task);
});

// Edit task
app.put("/tasks/:id", verifyToken, async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Admin only" });

  const updated = await Task.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  res.json(updated);
});

// Delete task
app.delete("/tasks/:id", verifyToken, async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Admin only" });

  await Task.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted successfully" });
});

// Verify task
app.put("/verify/:id", verifyToken, async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Admin only" });

  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { verified: true },
    { new: true }
  );

  res.json(task);
});

/* ================= TASK ROUTES ================= */

// Get tasks
app.get("/tasks", verifyToken, async (req, res) => {

  if (req.user.role === "admin") {
    const tasks = await Task.find()
      .populate("assignedTo", "name email");
    return res.json(tasks);
  }

  const tasks = await Task.find({
    assignedTo: req.user.id
  });

  res.json(tasks);
});

// Student update status
app.put("/status/:id", verifyToken, async (req, res) => {
  const { status } = req.body;

  const task = await Task.findById(req.params.id);
  if (!task)
    return res.status(404).json({ message: "Task not found" });

  if (task.assignedTo.toString() !== req.user.id)
    return res.status(403).json({ message: "Not allowed" });

  task.status = status;
  await task.save();

  res.json(task);
});

/* ================= SERVER START ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
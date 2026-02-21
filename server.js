// 🔥 Force Google DNS (Fix SRV on Windows)
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

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
  status: { type: String, default: "incomplete" },
  verified: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Task = mongoose.model("Task", taskSchema);

/* ================= AUTH MIDDLEWARE ================= */

const verifyToken = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "No token" });

  const token = header.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = decoded;
  next();
};

/* ================= AUTH ROUTES ================= */

// Register Student
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: "User exists" });

  const hash = await bcrypt.hash(password, 10);

  await User.create({
    name,
    email,
    password: hash,
    role: "student"
  });

  res.json({ message: "Registered successfully" });
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "User not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: "Invalid credentials" });

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

  const task = await Task.create(req.body);
  res.json(task);
});

// Edit task
app.put("/tasks/:id", verifyToken, async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Admin only" });

  const task = await Task.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  res.json(task);
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

/* ================= STUDENT ROUTES ================= */

// Get student tasks
app.get("/tasks", verifyToken, async (req, res) => {

  if (req.user.role === "admin") {
    const tasks = await Task.find().populate("assignedTo", "name email");
    return res.json(tasks);
  }

  const tasks = await Task.find({
    assignedTo: req.user.id
  });

  res.json(tasks);
});

// Student mark complete
app.put("/complete/:id", verifyToken, async (req, res) => {

  const task = await Task.findById(req.params.id);

  if (!task) return res.status(404).json({ message: "Not found" });

  if (task.assignedTo.toString() !== req.user.id)
    return res.status(403).json({ message: "Not allowed" });

  task.status = "completed";
  await task.save();

  res.json(task);
});

const PORT = 5000;
app.listen(PORT, () => console.log("Server running"));
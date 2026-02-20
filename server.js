require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// Use environment variable
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ DB Error:", err));

const studentSchema = new mongoose.Schema({
  name: String,
  email: String,
  course: String
}, { timestamps: true });

const Student = mongoose.model("Student", studentSchema);

// Routes
app.post("/students", async (req, res) => {
  const student = await Student.create(req.body);
  res.json(student);
});

app.get("/students", async (req, res) => {
  const students = await Student.find();
  res.json(students);
});

app.put("/students/:id", async (req, res) => {
  const student = await Student.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(student);
});

app.delete("/students/:id", async (req, res) => {
  await Student.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted Successfully" });
});

app.get("/", (req, res) => {
  res.send("Student Manager API Running 🚀");
});

// IMPORTANT for Render
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
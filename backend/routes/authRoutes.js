// backend/routes/authRoutes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const router = express.Router();

// --- REGISTRATION ROUTE ---
router.post("/register", async (req, res) => {
  const { fullName, phoneNumber, password, role } = req.body;
  try {
    if (!fullName || !phoneNumber || !password || !role) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields." });
    }
    let user = await User.findOne({ phoneNumber });
    if (user) {
      return res
        .status(400)
        .json({ message: "User with this phone number already exists." });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    user = new User({ fullName, phoneNumber, password: hashedPassword, role });
    await user.save();

    const payload = {
      user: { id: user.id, fullName: user.fullName, role: user.role },
    };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
      (err, token) => {
        if (err) throw err;
        res.status(201).json({ token, user: payload.user });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// --- LOGIN ROUTE ---
router.post("/login", async (req, res) => {
  const { phoneNumber, password } = req.body;
  try {
    // Check if user exists
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // Compare the provided password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // If credentials are correct, create and sign a new JWT
    const payload = {
      user: { id: user.id, fullName: user.fullName, role: user.role },
    };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
      (err, token) => {
        if (err) throw err;
        // Send the token and user data back to the frontend
        res.json({ token, user: payload.user });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;

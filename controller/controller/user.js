const JWT_SECRET_KEY = require("../config/jwtSecret");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../model/user");

const signup = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    console.log("phoneNumber: ", phoneNumber)

    // validate phone number
    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const phoneRegex = /^[6-9]\d{9}$/; // Starts with 6–9 and has 10 digits
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const user = await User.findOne({ phoneNumber });
    console.log(`user: `, user);

    if (user) {
      return res.status(400).json({ error: "Phone number already exists" });
    }

    const newUser = await User.create({
      phoneNumber,
      password
    });

    const token = jwt.sign({ phoneNumber }, JWT_SECRET_KEY, {
      expiresIn: "24h",
    });
    res.status(201).json({ message: "User signed up successfully", token, newUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

const login = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    console.log("phoneNumber: ", phoneNumber)

    const user = await User.findOne({ phoneNumber })
      .lean();
    console.log(`user: `, user);

    if (!user) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid password" });
    }

    const permissions = user.permissions
    const role = user.role
    const token = jwt.sign({ phoneNumber, role, id: user._id }, JWT_SECRET_KEY, {
      expiresIn: "24h",
    });

    // Create a user object without password for response
    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;

    res.status(200).json({
      message: "User Logged in successfully",
      token,
      permissions,
      role,
      user: userWithoutPassword
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

const executiveLogin = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    console.log("phoneNumber: ", phoneNumber)

    const user = await User.findOne({ phoneNumber })
      .lean();
    console.log(`user: `, user);

    if (!user) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    if (user.role !== "executive") {
      return res.status(400).json({ error: "Invalid role" });
    }

    // const isMatch = await bcrypt.compare(password, user.password);
    // if (!isMatch) {
    //   return res.status(400).json({ error: "Invalid password" });
    // }

    const permissions = user.permissions
    const role = user.role
    const token = jwt.sign({ phoneNumber, role, id: user._id }, JWT_SECRET_KEY, {
      expiresIn: "24h",
    });

    // Create a user object without password for response
    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;

    res.status(200).json({
      message: "Executive Logged in successfully",
      token,
      permissions,
      role,
      user: userWithoutPassword
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { signup, login, executiveLogin };

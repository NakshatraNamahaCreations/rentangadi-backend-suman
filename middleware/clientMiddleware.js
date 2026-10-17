const JWT_SECRET_KEY = require("../config/jwtSecret");
const jwt = require("jsonwebtoken");
const User = require("../model/user");
const AdminModel = require("../model/Auth/adminLogin");

const clientMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET_KEY);

    const client = await Clientmodel.findOne({ _id: decoded.clientId });
    if (!client) {
      return res.status(401).json({ error: "You are not authenticated" });
    }

    if (decoded.role !== "client") {
      return res.status(401).json({ error: "You are not authenticated" });
    }
    req.clientId = decoded.clientId;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    res.status(403).json({ error: "You are not authenticated" });
  }
}

const userMiddleware = async (req, res, next) => {
  try {
    // console.log(`req.headers: `, req.headers);
    const token = req.headers.authorization?.split(" ")[1]; // Extract token
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET_KEY);

    const user = await User.findOne({ _id: decoded.id });
    if (!user) {
      return res.status(401).json({ error: "You are not authenticated" });
    }


    if (decoded.role !== "executive" && decoded.role !== "client") {
      return res.status(401).json({ error: "You are not authenticated" });
    }

    req.userRole = user.role;
    if (user.role === 'client') {
      req.clientId = user.id;
    } else if (user.role === 'executive') {
      req.clientId = user.clientId.toString();
      req.executiveId = user.id;
    }
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    res.status(403).json({ error: "You are not authenticated" });
  }
}

const adminMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET_KEY);

    const admin = await AdminModel.findOne({ _id: decoded.adminId });
    if (!admin) {
      return res.status(401).json({ error: "You are not authenticated" });
    }

    if (decoded.role !== "superAdmin" && decoded.role !== "admin") {
      return res.status(401).json({ error: "You are not authenticated" });
    }
    req.clientId = decoded.clientId;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    res.status(403).json({ error: "You are not authenticated" });
  }
}

const authenticateClient = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET_KEY);

    const client = await User.findOne({ _id: decoded.id });
    if (!client || client.role !== "client") {
      return res.status(401).json({ error: "You are not authenticated" });
    }

    req.clientId = decoded.id;
    req.role = decoded.role;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    res.status(403).json({ error: "You are not authenticated" });
  }
}

const authorizeRoles = (...allowedRoles) => {
  return async (req, res, next) => {
    console.log(`allowedRoles: `, allowedRoles);
    try {
      const userRole = req.role;

      if (!userRole) {
        return res.status(403).json({ error: "Access denied. No role found." });
      }

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: "You are not authorized to access this resource." });
      }

      // If role matches, continue to the next middleware
      next();
    } catch (error) {
      // Handle any asynchronous errors here
      console.error(error);
      res.status(500).json({ error: "Server error" });
    }
  };

}


module.exports = { clientMiddleware, userMiddleware, adminMiddleware, authenticateClient, authorizeRoles };

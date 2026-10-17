const JWT_SECRET_KEY = require("../config/jwtSecret");
const jwt = require("jsonwebtoken");

function userMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET_KEY);
    req.email = decoded.email;
    req.random = "rentangadi";
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    res.status(403).json({ error: "You are not authenticated" });
  }
}

module.exports = userMiddleware;

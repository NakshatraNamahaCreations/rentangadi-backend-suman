const JWT_SECRET_KEY = require("../config/jwtSecret");
const jwt = require("jsonwebtoken");
const AdminModel = require("../model/Auth/adminLogin");

const superAdminMiddleware = async (req, res, next) => {
	try {
		const token = req.headers.authorization?.split(" ")[1]; // Extract token
		// console.log(`token: `, token);
		if (!token) {
			return res.status(401).json({ error: "No token provided" });
		}

		const decoded = jwt.verify(token, JWT_SECRET_KEY);
		req.email = decoded.email;

		const admin = await AdminModel.findOne({ email: req.email }).select("-password"); // Exclude password
		if (!admin) {
			return res.status(404).json({ error: "Admin not found" });
		}
		// console.log(`admin roles: `, admin.roles);
		// checl roles.superAdmin true else error
		if (admin.role !== "superAdmin") {
			return res.status(401).json({ error: "You are not authorized" });
		}

		req.superAdminId = admin.id
		next();
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
}

const adminMiddleware = async (req, res, next) => {
	try {
		const token = req.headers.authorization?.split(" ")[1]; // Extract token
		// console.log(`token: `, token);
		if (!token) {
			return res.status(401).json({ error: "No token provided" });
		}

		const decoded = jwt.verify(token, JWT_SECRET_KEY);
		req.email = decoded.email;

		const admin = await AdminModel.findOne({ email: req.email }).select("-password"); // Exclude password
		if (!admin) {
			return res.status(404).json({ error: "Admin not found" });
		}
		// console.log(`admin roles: `, admin.toJSON());
		console.log(`admin roles: `, admin.toObject());
		// checl roles.superAdmin true else error
//		if (admin.role !== "superAdmin" && admin.role !== "admin") {
//			return res.status(401).json({ error: "You are not authorized" });
//		}

		req.id = admin.id
		next();
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
}

module.exports = { superAdminMiddleware, adminMiddleware };

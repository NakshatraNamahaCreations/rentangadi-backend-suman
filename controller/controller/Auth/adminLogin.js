const AdminModel = require("../../model/Auth/adminLogin");
const JWT_SECRET_KEY = require("../../config/jwtSecret");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

async function adminSignUp(req, res) {
  try {
    const { email, password } = req.body;
    console.log("email pwd: ", email, password)

    const admin = await AdminModel.findOne({ email });
    console.log(`admin: `, admin);

    if (admin) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const newAdmin = await AdminModel.create({
      email,
      password: await bcrypt.hash(password, 10),
    });

    const token = await jwt.sign({ email }, JWT_SECRET_KEY, {
      expiresIn: "24h",
    });
    res.status(201).json({ success: "Admin signed up successfully", token });
  } catch (error) {
    res.status(500).json({ error: error });
  }
}

async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;

    const admin = await AdminModel.findOne({ email });
    console.log(`admin: `, admin.toObject());
    if (!admin) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const tokenPayload = { email, permissions: admin.permissions };

    const token = jwt.sign(tokenPayload, JWT_SECRET_KEY, { expiresIn: "24h" });

    // token stuff
    const now = new Date();
    const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours in ms

    // console.log("now time: ", now.toString());
    // console.log("now time + 2 hours: ", twoHoursLater.toString());
    // console.log("token expires in: ", token);


    res.status(200).json({ message: "Logged in successfully", token, permissions: admin.permissions });
  } catch (error) {
    console.log(`error: `, error);
    res.status(500).json({ error: error.message });
  }
}

async function adminsList(req, res) {
  try {
    const admins = await AdminModel.find().select("-password"); // Exclude password
    res.status(200).json({ admins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getAdminPermission(req, res) {
  try {
    const { id } = req;
    console.log(`getAdminPermission id: `, id);

    const admin = await AdminModel.findById(id);
    console.log(`getAdminPermission admin: `, admin.permissions);
    res.status(200).json({ admin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getAdminPermissionForSuperAdmin(req, res) {
  try {
    const { id } = req.params;
    const admin = await AdminModel.findById(id);
    console.log(`getAdminPermissionForSuperAdmin admin: `, admin);
    res.status(200).json({ admin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updateAdminPermission(req, res) {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    const admin = await AdminModel.findByIdAndUpdate(id, { permissions }, { new: true });
    console.log(`admin: `, admin.toJSON());
    res.status(200).json({ admin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
module.exports = { adminSignUp, adminLogin, adminsList, updateAdminPermission, getAdminPermission, getAdminPermissionForSuperAdmin };

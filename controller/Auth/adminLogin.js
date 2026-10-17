const AdminModel = require("../../model/Auth/adminLogin");
const JWT_SECRET_KEY = require("../../config/jwtSecret");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose")
// async function adminSignUp(req, res) {
//   try {
//     const { email, password } = req.body;
//     console.log("email pwd: ", email, password)

//     const admin = await AdminModel.findOne({ email });
//     console.log(`admin: `, admin);

//     if (admin) {
//       return res.status(400).json({ error: "Email already exists" });
//     }

//     const newAdmin = await AdminModel.create({
//       email,
//       password: await bcrypt.hash(password, 10),
//     });

//     const token = await jwt.sign({ email }, JWT_SECRET_KEY, {
//       expiresIn: "24h",
//     });
//     res.status(201).json({ success: "Admin signed up successfully", token });
//   } catch (error) {
//     res.status(500).json({ error: error });
//   }
// }

// by sonali
// async function adminSignUp(req, res) {
//   try {
//     const { email, password, role, permissions } = req.body;

//     if (!email || !password || !role) {
//       return res.status(400).json({ error: "Email, password and role are required" });
//     }

//     const existingAdmin = await AdminModel.findOne({ email });
//     if (existingAdmin) {
//       return res.status(400).json({ error: "Email already exists" });
//     }

//     let finalPermissions = {};

//     // ✅ If superAdmin → give full access
//     if (role === "superAdmin") {
//       finalPermissions = {
//         adminRights: true,
//         master: true,
//         banner: true,
//         dashboard: true,
//         productManagement: true,
//         clients: true,
//         executiveManagement: true,
//         addNewEnquiry: true,
//         myOrders: true,
//         enquiryList: true,
//         enquiryCalendar: true,
//         quotation: true,
//         orders: true,
//         termsAndConditions: true,
//         paymentReport: true,
//         refurbishmentReport: true,
//         inventoryProductList: true,
//         reports: true,
//         damagedAndLost: true,
//         settings: true,
//       };
//     }
//     // ✅ If normal admin → use passed permissions
//     else {
//       finalPermissions = permissions || {};
//     }

//     const newAdmin = await AdminModel.create({
//       email,
//       password: await bcrypt.hash(password, 10),
//       role,
//       permissions: finalPermissions,
//     });

//     const token = jwt.sign(
//       {
//         id: newAdmin._id,
//         email: newAdmin.email,
//         role: newAdmin.role,
//         permissions: newAdmin.permissions,
//       },
//       JWT_SECRET_KEY,
//       { expiresIn: "24h" }
//     );

//     res.status(201).json({
//       success: "Admin signed up successfully",
//       token,
//       role: newAdmin.role,
//       permissions: newAdmin.permissions,
//     });
//   } catch (error) {
//     console.error("Signup Error:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// }

async function adminSignUp(req, res) {
  try {
    const { email, password, role, permissions } = req.body;

    if (!email || !password || !role) {
      return res
        .status(400)
        .json({ error: "Email, password and role are required" });
    }

    const allowedRoles = ["superAdmin", "admin", "warehouse"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const existingAdmin = await AdminModel.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // ✅ Only store these keys (prevents garbage/unexpected keys)
    const ALLOWED_PERMISSION_KEYS = [
      // role flags
      "superAdmin",
      "admin",
      "warehouse",

      // modules
      "adminRights",
      "master",
      "banner",
      "dashboard",
      "productManagement",
      "clients",
      "executiveManagement",
      "addNewEnquiry",
      "myOrders",
      "enquiryList",
      "enquiryCalendar",
      "quotation",
      "orders",
      "termsAndConditions",
      "paymentReport",
      "refurbishmentReport",
      "inventoryProductList",
      "reports",
      "damagedAndLost",
      "settings",
    ];

    // ✅ convert "true"/"false" -> boolean, numbers -> boolean, etc.
    const toBool = (v) => {
      if (typeof v === "boolean") return v;
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "true") return true;
        if (s === "false") return false;
      }
      if (typeof v === "number") return v !== 0;
      return false;
    };

    const normalizePermissions = (incoming) => {
      const src = incoming && typeof incoming === "object" ? incoming : {};
      const out = {};

      for (const key of ALLOWED_PERMISSION_KEYS) {
        if (Object.prototype.hasOwnProperty.call(src, key)) {
          out[key] = toBool(src[key]);
        }
      }

      return out;
    };

    let finalPermissions = {};

    // ✅ If superAdmin → force ALL permissions true
    if (role === "superAdmin") {
      finalPermissions = {};
      for (const key of ALLOWED_PERMISSION_KEYS) {
        finalPermissions[key] = true;
      }

      // keep role flags consistent
      finalPermissions.superAdmin = true;
      finalPermissions.admin = true; // optional but matches your permission object style
      finalPermissions.warehouse = false; // optional
    } else {
      // ✅ For admin/warehouse → store ONLY frontend keys (sanitized)
      finalPermissions = normalizePermissions(permissions);

      // ✅ Force role rules
      finalPermissions.superAdmin = false;

      if (role === "admin") {
        finalPermissions.adminRights = true;
        finalPermissions.admin = true;
        finalPermissions.warehouse = false; // optional
      }

      if (role === "warehouse") {
        finalPermissions.warehouse = true;
        finalPermissions.admin = false; // optional
        // if warehouse should also have adminRights, set it true here (your choice)
        // finalPermissions.adminRights = true;
      }
    }

    const newAdmin = await AdminModel.create({
      email,
      password: await bcrypt.hash(password, 10),
      role,
      permissions: finalPermissions,
    });

    const token = jwt.sign(
      {
        id: newAdmin._id,
        email: newAdmin.email,
        role: newAdmin.role,
        permissions: newAdmin.permissions,
      },
      JWT_SECRET_KEY,
      { expiresIn: "24h" }
    );

    return res.status(201).json({
      success: "Admin signed up successfully",
      token,
      role: newAdmin.role,
      permissions: newAdmin.permissions,
    });
  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
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


    res.status(200).json({ message: "Logged in successfully", token, permissions: admin.permissions, });
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


async function deleteAdminAccount(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid admin id" });
    }

    const deleted = await AdminModel.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    return res.json({
      success: true,
      message: "Admin deleted successfully",
      data: { _id: deleted._id, email: deleted.email, role: deleted.role },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};



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
module.exports = { adminSignUp, adminLogin, adminsList, deleteAdminAccount,   updateAdminPermission, getAdminPermission, getAdminPermissionForSuperAdmin };

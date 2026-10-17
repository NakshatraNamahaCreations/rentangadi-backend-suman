const express = require("express");
const router = express.Router();
const { adminSignUp, adminLogin, adminsList, deleteAdminAccount,  getAdminPermission, updateAdminPermission, getAdminPermissionForSuperAdmin } = require("../../controller/Auth/adminLogin");
// const adminMiddleware = require("../../middleware/clientMiddleware");
const AdminModel = require("../../model/Auth/adminLogin");
const { superAdminMiddleware, adminMiddleware } = require("../../middleware/superAdminMiddleware");

// Sign-up route
router.post("/adminSignUp", adminSignUp);

// Login route
router.post("/adminLogin", adminLogin);

router.get("/admins-list", superAdminMiddleware, adminsList);
router.get("/admins/permissions", adminMiddleware, getAdminPermission)
router.get("/admins/permissions/:id", superAdminMiddleware, getAdminPermissionForSuperAdmin)
router.put("/admins/permissions/:id", superAdminMiddleware, updateAdminPermission)
router.delete("/admins/:id", deleteAdminAccount);
// Protected route to get admin details using the token
router.get("/adminDetails", adminMiddleware, async (req, res) => {
  try {
    const email = req.email;
    const admin = await AdminModel.findOne({ email }).select("-password"); // Exclude password
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }
    res.status(200).json({ admin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

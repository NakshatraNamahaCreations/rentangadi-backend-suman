const express = require("express");
const router = express.Router();
const executiveController = require("../controller/executive");
const { clientMiddleware, authorizeRoles, authenticateClient, userMiddleware } = require("../middleware/clientMiddleware");
// const { authMiddleware } = require("../middleware/auth");
// const { roleCheck } = require("../middleware/roleCheck");


// Protected routes (require authentication)
// router.use(authMiddleware);

// Routes that require admin role
// router.use("/", roleCheck(['admin']));

router.use(authenticateClient);

router.post("/", authenticateClient, authorizeRoles('client'), executiveController.createExecutive);
router.get("/", authenticateClient, authorizeRoles('client'), executiveController.getAllExecutives);
router.get("/:id", authenticateClient, authorizeRoles('client'), executiveController.getExecutive);
router.put("/:id", authenticateClient, userMiddleware, authorizeRoles('client'), executiveController.updateExecutive);
router.delete("/:id", authenticateClient, userMiddleware, authorizeRoles('client'), executiveController.deleteExecutive);

module.exports = router;

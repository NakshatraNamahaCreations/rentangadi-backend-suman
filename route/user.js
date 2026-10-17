const express = require("express");
const router = express.Router();
const { signup, login, executiveLogin } = require("../controller/user");



router.post("/signup", signup);
router.post("/login", login);
router.post("/executiveLogin", executiveLogin);

module.exports = router;

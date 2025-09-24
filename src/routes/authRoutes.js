const express = require("express");
const router = express.Router();
const { register, login, checkUsername, searchUsers } = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.get("/username-available", checkUsername);
router.get("/search", searchUsers);

module.exports = router;

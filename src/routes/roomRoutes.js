const express = require("express");
const router = express.Router();
const { createRoom, getRooms, getRoomBySlug, createInvite, resolveInvite } = require("../controllers/roomController");

router.post("/", createRoom);
router.get("/", getRooms);
router.get("/slug/:slug", getRoomBySlug);
router.post("/:roomId/invite", createInvite);
router.get("/invite/:token", resolveInvite);

module.exports = router;

const express = require("express");
const router = express.Router();
const { getMessagesByRoom } = require("../controllers/messageController");

// Get messages for a room
router.get("/:roomId", async (req, res) => {
    try {
        const messages = await getMessagesByRoom(req.params.roomId);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

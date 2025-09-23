// src/controllers/messageController.js
const Message = require("../models/Message");

/**
 * Add a new message to the database
 * @param {Object} param0 - { room, sender, text }
 * @returns {Promise<Object>} - The saved message
 */
exports.addMessage = async ({ room, sender, text }) => {
    try {
        const message = new Message({ room, sender, text });
        await message.save();
        // Populate sender's name for returning
        return await message.populate("sender", "name");
    } catch (err) {
        console.error("Error adding message:", err);
        throw err;
    }
};

/**
 * Get all messages for a specific room
 * @param {String} roomId - Room ID
 * @returns {Promise<Array>} - Array of messages
 */
exports.getMessagesByRoom = async (roomId) => {
    try {
        const messages = await Message.find({ room: roomId })
            .populate("sender", "name")
            .sort({ createdAt: 1 }); // sort messages by time ascending
        return messages;
    } catch (err) {
        console.error("Error fetching messages:", err);
        throw err;
    }
};

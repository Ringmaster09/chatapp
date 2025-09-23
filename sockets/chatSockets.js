// sockets/chatSockets.js
let addMessage;
try {
    ({ addMessage } = require("../src/controllers/messageController"));
} catch (err) {
    console.error("Failed to load messageController:", err);
}

module.exports = (io) => {
    io.on("connection", (socket) => {
        console.log("New client connected:", socket.id);

        socket.on("joinRoom", (roomId) => {
            socket.join(roomId);
        });

        socket.on("chatMessage", async ({ roomId, userId, text }) => {
            if (!addMessage) return;
            try {
                const message = await addMessage({ room: roomId, sender: userId, text });
                io.to(roomId).emit("message", message);
            } catch (err) {
                console.error("Error saving message:", err);
            }
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });
};

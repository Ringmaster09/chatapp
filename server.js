require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const socketHandler = require("./sockets/chatSockets");

const authRoutes = require("./src/routes/authRoutes");
const roomRoutes = require("./src/routes/roomRoutes");
const messageRoutes = require("./src/routes/messageRoutes");

const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
// Prevent 404 spam for favicon when none is provided
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/messages", messageRoutes);

// WebSocket
socketHandler(io);

async function fixIndexes() {
    try {
        const Room = require("./src/models/Room");
        // Drop legacy non-sparse unique index if it exists
        const indexes = await Room.collection.indexes();
        const legacy = indexes.find(i => i.name === "invites.token_1");
        if (legacy && !(legacy.sparse === true)) {
            try { await Room.collection.dropIndex("invites.token_1"); } catch (_) {}
        }
        // Ensure current indexes
        await Room.syncIndexes();
        console.log("Room indexes synced");
    } catch (e) {
        console.warn("Index sync warning:", e.message);
    }
}

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(async () => {
    console.log("MongoDB Connected");
    await fixIndexes();
})
.catch(err => console.log("MongoDB Error:", err));

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// sockets/chatSockets.js
let addMessage;
try {
    ({ addMessage } = require("../src/controllers/messageController"));
} catch (err) {
    console.error("Failed to load messageController:", err);
}

// In-memory stores (reset on server restart)
const roomPolls = new Map(); // roomId -> { polls: Map<pollId, poll> }
const roomGames = new Map(); // roomId -> { ttt: { id, board, turn, players } }
const roomWatch = new Map(); // roomId -> { provider, videoId, position, playing, updatedAt }

function getRoomPolls(roomId) {
    if (!roomPolls.has(roomId)) roomPolls.set(roomId, { polls: new Map() });
    return roomPolls.get(roomId);
}

function getRoomGame(roomId) {
    if (!roomGames.has(roomId)) roomGames.set(roomId, { ttt: null });
    return roomGames.get(roomId);
}

function getRoomWatch(roomId) {
    if (!roomWatch.has(roomId)) roomWatch.set(roomId, { provider: null, videoId: null, position: 0, playing: false, updatedAt: Date.now() });
    return roomWatch.get(roomId);
}

function newId(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function checkTttWinner(board) {
    const lines = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];
    for (const [a,b,c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    if (board.every(Boolean)) return 'draw';
    return null;
}

module.exports = (io) => {
    io.on("connection", (socket) => {
        console.log("New client connected:", socket.id);

        socket.on("joinRoom", (roomId) => {
            socket.join(roomId);
            // send current watch state to late joiners
            const w = getRoomWatch(roomId);
            io.to(socket.id).emit("watch:state", w);
        });

        socket.on("chatMessage", async ({ roomId, userId, text, whisperToUsername }) => {
            if (!addMessage) return;
            try {
                const message = await addMessage({ room: roomId, sender: userId, text });
                // Forward message to room
                io.to(roomId).emit("message", message);
            } catch (err) {
                console.error("Error saving message:", err);
            }
        });

        // Polls
        socket.on("poll:create", ({ roomId, question, options }) => {
            if (!roomId || !question || !Array.isArray(options) || options.length < 2) return;
            const store = getRoomPolls(roomId);
            const id = newId('poll');
            const poll = { id, question: String(question).slice(0, 200), options: options.slice(0, 6).map(o => ({ label: String(o).slice(0, 80), votes: 0 })), createdAt: Date.now() };
            store.polls.set(id, poll);
            io.to(roomId).emit("poll:created", poll);
        });

        socket.on("poll:vote", ({ roomId, pollId, optionIndex }) => {
            const store = getRoomPolls(roomId);
            const poll = store.polls.get(pollId);
            if (!poll) return;
            if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex >= poll.options.length) return;
            poll.options[optionIndex].votes += 1;
            io.to(roomId).emit("poll:updated", poll);
        });

        // Tic-Tac-Toe
        socket.on("ttt:start", ({ roomId }) => {
            const gameStore = getRoomGame(roomId);
            if (!gameStore.ttt) {
                gameStore.ttt = { id: newId('ttt'), board: Array(9).fill(null), turn: 'X', players: {} };
            } else {
                gameStore.ttt.board = Array(9).fill(null);
                gameStore.ttt.turn = 'X';
                gameStore.ttt.players = {};
            }
            io.to(roomId).emit("ttt:state", gameStore.ttt);
        });

        socket.on("ttt:join", ({ roomId, userId }) => {
            const gameStore = getRoomGame(roomId);
            if (!gameStore.ttt) return;
            const g = gameStore.ttt;
            if (!g.players.X) g.players.X = userId;
            else if (!g.players.O && g.players.X !== userId) g.players.O = userId;
            io.to(roomId).emit("ttt:state", g);
        });

        socket.on("ttt:move", ({ roomId, userId, index }) => {
            const gameStore = getRoomGame(roomId);
            if (!gameStore.ttt) return;
            const g = gameStore.ttt;
            if (index < 0 || index > 8) return;
            const symbol = (g.players.X === userId) ? 'X' : (g.players.O === userId ? 'O' : null);
            if (!symbol) return;
            if (g.board[index] !== null) return;
            if (g.turn !== symbol) return;
            g.board[index] = symbol;
            const win = checkTttWinner(g.board);
            if (win) {
                io.to(roomId).emit("ttt:over", { winner: win });
            } else {
                g.turn = (g.turn === 'X') ? 'O' : 'X';
                io.to(roomId).emit("ttt:state", g);
            }
        });

        // Watch Party (YouTube proof-of-concept)
        socket.on("watch:load", ({ roomId, provider, videoId, position }) => {
            const w = getRoomWatch(roomId);
            w.provider = provider || 'youtube';
            w.videoId = String(videoId || '');
            w.position = Number(position || 0);
            w.playing = false;
            w.updatedAt = Date.now();
            io.to(roomId).emit("watch:state", w);
        });
        socket.on("watch:play", ({ roomId }) => {
            const w = getRoomWatch(roomId);
            w.playing = true;
            w.updatedAt = Date.now();
            io.to(roomId).emit("watch:state", w);
        });
        socket.on("watch:pause", ({ roomId, position }) => {
            const w = getRoomWatch(roomId);
            if (typeof position === 'number') w.position = position;
            w.playing = false;
            w.updatedAt = Date.now();
            io.to(roomId).emit("watch:state", w);
        });
        socket.on("watch:seek", ({ roomId, position }) => {
            const w = getRoomWatch(roomId);
            w.position = Number(position || 0);
            w.updatedAt = Date.now();
            io.to(roomId).emit("watch:state", w);
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });
};

const Room = require("../models/Room");

function slugify(name) {
    const base = String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
    const rand = Math.random().toString(36).slice(2, 8);
    return `${base || 'room'}-${rand}`;
}

function generateInviteToken() {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2, 8);
}

exports.createRoom = async (req, res) => {
    try {
        const { name, durationMinutes } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });
        let slug;
        for (let i = 0; i < 5; i++) {
            slug = slugify(name);
            const exists = await Room.exists({ slug });
            if (!exists) break;
            slug = null;
        }
        if (!slug) return res.status(500).json({ error: 'failed to generate unique slug' });
        let expiresAt = null;
        const duration = Number(durationMinutes);
        if (!Number.isNaN(duration) && duration > 0) {
            expiresAt = new Date(Date.now() + duration * 60 * 1000);
        }
        const room = new Room({ name, slug, expiresAt });
        await room.save();
        res.status(201).json(room);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getRooms = async (req, res) => {
    const rooms = await Room.find();
    res.json(rooms);
};

exports.getRoomBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const room = await Room.findOne({ slug });
        if (!room) return res.status(404).json({ error: 'Room not found' });
        res.json(room);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createInvite = async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ error: 'Room not found' });
        let token;
        for (let i = 0; i < 5; i++) {
            token = generateInviteToken();
            const exists = await Room.exists({ 'invites.token': token });
            if (!exists) break;
            token = null;
        }
        if (!token) return res.status(500).json({ error: 'failed to generate invite' });
        room.invites.push({ token });
        await room.save();
        res.status(201).json({ token, slug: room.slug, roomId: room._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.resolveInvite = async (req, res) => {
    try {
        const { token } = req.params;
        const room = await Room.findOne({ 'invites.token': token });
        if (!room) return res.status(404).json({ error: 'Invite not found' });
        res.json({ roomId: room._id, slug: room.slug, name: room.name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

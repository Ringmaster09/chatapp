const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

exports.register = async (req, res) => {
    try {
        const { name, username, email, password } = req.body;
        if (!name || !username || !email || !password) {
            return res.status(400).json({ error: "name, username, email and password are required" });
        }
        const normalizedUsername = String(username).trim().toLowerCase();
        const exists = await User.findOne({ $or: [{ email }, { username: normalizedUsername }] });
        if (exists) {
            const field = exists.email === email ? "email" : "username";
            return res.status(409).json({ error: `${field} already in use` });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, username: normalizedUsername, email, password: hashedPassword });
        await user.save();
        res.status(201).json({ message: "User created" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, user: { id: user._id, name: user.name, username: user.username } });
};

exports.checkUsername = async (req, res) => {
    try {
        const username = String(req.query.username || '').trim().toLowerCase();
        if (!username) return res.status(400).json({ available: false, error: 'username is required' });
        const exists = await User.exists({ username });
        res.json({ available: !exists });
    } catch (err) {
        res.status(500).json({ available: false, error: err.message });
    }
};

exports.searchUsers = async (req, res) => {
    try {
        const q = String(req.query.q || '').trim().toLowerCase();
        if (!q) return res.json([]);
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const users = await User.find({ $or: [{ username: rx }, { name: rx }] })
            .select('_id name username')
            .limit(20)
            .lean();
        res.json(users.map(u => ({ id: u._id, name: u.name, username: u.username })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const mongoose = require("mongoose");

const InviteSchema = new mongoose.Schema({
    token: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const RoomSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    invites: { type: [InviteSchema], default: [] },
    expiresAt: { type: Date, default: null }
}, { timestamps: true });

// TTL index: when expiresAt passes, MongoDB will delete the document
RoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Ensure invite tokens are unique only when present
RoomSchema.index({ 'invites.token': 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Room", RoomSchema);

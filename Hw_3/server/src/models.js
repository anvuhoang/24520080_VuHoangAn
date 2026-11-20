// server/src/models.js — Mongoose 8 models. Async/await only: Mongoose 8 removed callbacks.
import mongoose from 'mongoose';
import { CATEGORIES, LIMITS } from '../../client/src/appeal/appealRules.js';

const infractionSchema = new mongoose.Schema(
  {
    rule: { type: String, required: true, trim: true, maxlength: 80 },
    severity: { type: Number, required: true, min: 1, max: 5 },
    penaltyMinutes: { type: Number, required: true, min: 0 },
  },
  { versionKey: false }
);

const dossierSchema = new mongoose.Schema(
  {
    playerId: { type: String, required: true, unique: true, match: /^[a-z0-9-]{1,30}$/ },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    team: { type: String, required: true, trim: true, maxlength: 60 },
    matchesPlayed: { type: Number, required: true, min: 0 },
    reportsReceived: { type: Number, required: true, min: 0 },
    infractions: { type: [infractionSchema], default: [] },
    appealDeadline: { type: Date, required: true }, // an absolute instant, set by the server
  },
  { versionKey: false }
);

// One appeal per player (unique playerId): a double click or two tabs cannot file it twice.
const appealSchema = new mongoose.Schema(
  {
    playerId: { type: String, required: true, unique: true },
    appellantName: { type: String, required: true, trim: true, maxlength: LIMITS.name.max },
    email: { type: String, required: true, lowercase: true, maxlength: LIMITS.email },
    category: { type: String, required: true, enum: CATEGORIES.map((c) => c.id) },
    statement: { type: String, required: true, trim: true, maxlength: LIMITS.statement.max },
    evidenceUrl: { type: String, default: '', maxlength: LIMITS.url },
  },
  { versionKey: false, timestamps: { createdAt: true, updatedAt: false } }
);

export const Dossier = mongoose.models.Dossier ?? mongoose.model('Dossier', dossierSchema);
export const Appeal = mongoose.models.Appeal ?? mongoose.model('Appeal', appealSchema);

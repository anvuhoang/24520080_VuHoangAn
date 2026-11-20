// server/src/models.js — Mongoose 8 models. Async/await only: Mongoose 8 removed callbacks.
import mongoose from 'mongoose';

// left = PASS, right = LIKE, up = SUPER on the client
export const ACTIONS = Object.freeze(['PASS', 'LIKE', 'SUPER']);

const profileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    age: { type: Number, required: true, min: 18, max: 120 },
    bio: { type: String, required: true, trim: true, maxlength: 280 },
    order: { type: Number, required: true, unique: true }, // position in the deck
  },
  { versionKey: false }
);

// One swipe per profile at a time (unique profileId): a double click or a repeated key cannot record the same card twice.
const swipeSchema = new mongoose.Schema(
  {
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true, unique: true },
    action: { type: String, enum: ACTIONS, required: true },
  },
  { versionKey: false, timestamps: { createdAt: true, updatedAt: false } }
);

export const Profile = mongoose.models.Profile ?? mongoose.model('Profile', profileSchema);
export const Swipe = mongoose.models.Swipe ?? mongoose.model('Swipe', swipeSchema);

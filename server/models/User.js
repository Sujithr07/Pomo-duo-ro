const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  stats: {
    completedPomodoros: { type: Number, default: 0 },
    totalWorkTime: { type: Number, default: 0 },
    totalBreakTime: { type: Number, default: 0 },
    score: { type: Number, default: 0 }
  },
  currentSession: {
    isRunning: { type: Boolean, default: false },
    isBreak: { type: Boolean, default: false },
    timeLeft: { type: Number, default: 1500 }, // 25 minutes in seconds
    lastActive: { type: Date, default: Date.now }
  },
  duoPartner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema); 
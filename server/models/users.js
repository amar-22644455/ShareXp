const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profileImage: { 
    type: String, 
    default: "https://picsum.photos/100",
    set: function(value) {
      // If value is a file path, prepend the correct URL path
      if (value && !value.startsWith('http')) {
        return `/profile-images/${value}`;
      }
      return value;
    }
  },
  institute: { type: String, required: true }, // College/University Name
  mobile: { type: String, required: true, unique: true }, // Mobile Number Field
  skills: [String], // Example: ["C++", "React", "Machine Learning"]
  description: { type: String, default: "Hello! I am using ShareXP." }, // New Description Field
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // List of user IDs following this user
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // List of us er IDs this user follows
  unreadNotifications: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (this.isModified('password') || this.isNew) {
    try {
      this.password = await bcrypt.hash(this.password, 10);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Function to get follower count
UserSchema.methods.getFollowerCount = function () {
  return this.followers.length;
};

// Function to get following count
UserSchema.methods.getFollowingCount = function () {
  return this.following.length;
};

// In your User schema
UserSchema.virtual('posts', {
  ref: 'Post',
  localField: '_id',
  foreignField: 'user'
});

const User = mongoose.model('User', UserSchema);

module.exports = User;

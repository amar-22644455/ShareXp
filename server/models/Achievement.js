const mongoose = require("mongoose");

const achievementSchema = new mongoose.Schema(
  {

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

   
    category: {
      type: String,
      enum: ["Technical", "Cultural", "Sports", "Academic"],
      required: true,
      index: true,
    },

   
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    
    date: {
      type: String, // e.g. "Jan 2024"
      required: true,
      trim: true,
    },

    
    certificateUrl: {
      type: String,
      trim: true,
      match: /^https?:\/\/.+/i, // basic URL validation
    },

    imageUrl: {
      type: String,
      trim: true,
      match: /^https?:\/\/.+/i,
    },

    
    tags: {
      type: [String],
      default: [],
      set: tags =>
        tags.map(tag => tag.toLowerCase().trim()),
    },
    
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);



// Fast sorting + filtering
achievementSchema.index({ user: 1, createdAt: -1 });

// Optional: prevent duplicate titles per user
achievementSchema.index(
  { user: 1, title: 1 },
  { unique: false } // set true ONLY if you want strict uniqueness
);

module.exports = mongoose.model("Achievement", achievementSchema);

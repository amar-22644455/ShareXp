const { check, validationResult } = require('express-validator');
const express = require('express');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/users');
const auth = require("../middleware/auth");
const Post = require('../models/posts');
const Notification = require('../models/notification'); // Adjust path as needed

const multer = require("multer");

const PROFILE_IMAGE_LIMIT_MB = Number(process.env.PROFILE_IMAGE_LIMIT_MB || 5);
const PROFILE_IMAGE_LIMIT_BYTES = PROFILE_IMAGE_LIMIT_MB * 1024 * 1024;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "profile-images/"); // Save files in "uploads" directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname); // Unique filename
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: PROFILE_IMAGE_LIMIT_BYTES,
  },
});

const uploadProfileImage = (req, res, next) => {
  upload.single('profileImage')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        message: `File too large. Max allowed size is ${PROFILE_IMAGE_LIMIT_MB}MB.`,
      });
    }

    if (err) {
      return res.status(400).json({ error: err.message });
    }

    return next();
  });
};
router.patch(
  '/:id/profile-image',
  auth,
  uploadProfileImage,
  async (req, res) => {
    console.log('--- START PROFILE IMAGE UPLOAD ---');
    console.log('Request params:', req.params);
    console.log('Request user:', req.user);
    console.log('Uploaded file:', req.file);

    try {
      // 1. Check if user exists
      console.log('Checking user existence...');
      const user = await User.findById(req.params.id);
      if (!user) {
        console.error('User not found for ID:', req.params.id);
        return res.status(404).json({ error: 'User not found' });
      }
      console.log('User found:', user.username);

      // 2. Authorization check
      console.log('Verifying authorization...');
      console.log('Request user ID:', req.user.id, 'vs Param ID:', req.params.id);
      if (req.user.id !== req.params.id) {
        console.error('Authorization failed - User ID mismatch');
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // 3. Check if file was uploaded
      console.log('Checking file upload...');
      if (!req.file) {
        console.error('No file uploaded');
        return res.status(400).json({ error: 'No image provided' });
      }
      console.log('File uploaded successfully:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        filename: req.file.filename
      });

      // 4. Update user
      console.log('Updating user profile image...');
      const updateData = { profileImage: req.file.filename };
      console.log('Update data being sent:', updateData);

      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      ).select('-password');

      console.log('User after update:', {
        id: updatedUser._id,
        profileImage: updatedUser.profileImage
      });

      // 5. Return response
      console.log('--- UPLOAD SUCCESSFUL ---');
      res.json(updatedUser);

    } catch (err) {
      console.error('!!! PROFILE UPLOAD ERROR !!!');
      console.error('Error:', err.message);
      console.error('Stack:', err.stack);
      console.error('Full error object:', err);

      res.status(500).json({ 
        error: 'Failed to upload profile picture',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

// Create a new user (Signup)
router.post('/CreateXp', async (req, res) => {
  try {
    const { name, email, institute, password, username, mobile } = req.body;

    // Check if the email or username already exists
    let existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: "Email or username already exists" });
    }



    // Create and save new user
    const user = new User({
      name,
      email,
      institute,
      password,
      username,
      mobile
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Set httpOnly strict sameSite cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });

    // Return the new user and token
    res.status(201).json({ 
      message: "User created successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        institute: user.institute,
        mobile: user.mobile
      }
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

// Get user name (Example API)
router.get('/users/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ name: user.name , username:user.username ,profileImage: user.profileImage  });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

// Get User Profile with Posts
router.get('/Profile/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);  // Fetch user with posts
    if (!user) return res.status(404).json({ message: "User not found" });
    const posts = await Post.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .populate('userId', 'name username profileImage institute')
      .populate('comments.userId', 'username profileImage')
      .lean();

    const formattedPosts = posts.map(post => {
      const isLiked = post.likes?.some(like => like.equals(req.user._id)) || false;
      const likeCount = post.likes?.length || 0;
      const commentCount = post.comments?.length || 0;
      return {
        ...post,
        isLiked,
        likeCount,
        commentCount
      };
    });

    res.json({
      name: user.name,
      username: user.username,
      institute: user.institute,
      posts: formattedPosts,
      profileImage: user.profileImage,
      skills:user.skills || [],
      followers: user.followers || 0 ,
      following: user.following || 0
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

// Get all users for client-side searching
router.get("/all-users", auth, async (req, res) => {
  try {
    // Fetch all users with only necessary fields
    const users = await User.find({})
      .select("username name _id profileImage") // Add any other fields you want
      .limit(1000); // Set a reasonable limit
    
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Add a new skill to user's profile
router.post('/:userId/skills-add', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { skill } = req.body;

    // Authorization check - user can only modify their own skills
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to modify this user\'s skills' });
    }

    // Input validation
    if (!skill || typeof skill !== 'string' || !skill.trim()) {
      return res.status(400).json({ error: 'Valid skill string is required' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { skills: skill.trim() } }, // Avoid duplicates
      { new: true, select: 'skills' }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Skill added successfully',
      skills: updatedUser.skills
    });

  } catch (error) {
    console.error('Error adding skill:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove a skill from user's profile
// DELETE /api/:userId/skills/:skill
router.delete('/:userId/skills/:skill', auth, async (req, res) => {
  try {
    const { userId, skill } = req.params;

    // Authorization check - user can only modify their own skills
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to modify this user\'s skills' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { skills: skill } }, // Remove the skill string
      { new: true, select: 'skills' }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Skill removed successfully',
      skills: user.skills
    });

  } catch (error) {
    console.error('Error removing skill:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all skills of a user
router.get('/:userId/skills', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('skills');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ skills: user.skills || [] });
  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search users by skill
router.get('/search/skills', async (req, res) => {
  try {
      const { skill } = req.query;

      if (!skill) {
          return res.status(400).json({ error: 'Skill query parameter is required' });
      }

      const users = await User.find(
          { skills: { $regex: skill, $options: 'i' } },
          { name: 1, username: 1, profileImage: 1, skills: 1 }
      );

      res.json(users);

  } catch (error) {
      console.error('Error searching by skill:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all unique skills across all users (for skill suggestions)
router.get('/skills/all', async (req, res) => {
  try {
      const skills = await User.aggregate([
          { $unwind: '$skills' },
          { $group: { _id: '$skills' } },
          { $project: { _id: 0, skill: '$_id' } }
      ]);

      res.json(skills.map(item => item.skill));

  } catch (error) {
      console.error('Error fetching all skills:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// // Search users by name or username
// router.get("/search",auth, async (req, res) => {
//   try {
//     const { query } = req.query;

//     if (!query) {
//       return res.status(400).json({ message: "Query is required" });
//     }

//     // Search for users where either username or name matches the query
//     const users = await User.find({
//       $or: [
//         { username: { $regex: query, $options: "i" } }, // Case-insensitive username match
//         { name: { $regex: query, $options: "i" } }, // Case-insensitive name match
//       ],
//     }).select("username name _id"); // Fetch only required fields

//     res.json(users);
//   } catch (error) {
//     console.error("Search Error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

router.get('/userprofile/:id', auth, async (req, res) => {
  try {
    const profileUser = await User.findById(req.params.id).select('-password');
    if (!profileUser) return res.status(404).json({ message: "User not found" });

    const posts = await Post.find({ userId: req.params.id })
      .sort({ createdAt: -1 })
      .populate('userId', 'name username profileImage institute')
      .populate('comments.userId', 'username profileImage')
      .lean();

    // Check if logged-in user follows the profile user
    const isFollowing = profileUser.followers.includes(req.user._id);

    const formattedPosts = posts.map(post => {
      const isLiked = post.likes?.some(like => like.equals(req.user._id)) || false;
      const likeCount = post.likes?.length || 0;
      const commentCount = post.comments?.length || 0;
      return {
        ...post,
        isLiked,
        likeCount,
        commentCount
      };
    });

    res.json({
      user: {
        id: profileUser._id,
        name: profileUser.name,
        username: profileUser.username,
        institute: profileUser.institute,
        profileImage: profileUser.profileImage,
        skills: profileUser.skills || [],
        followers: profileUser.followers || [],
        following: profileUser.following || []
      },
      isFollowing,
      posts: formattedPosts
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

// Helper: emit a real-time notification to a recipient's socket room.
// Returns true if the recipient was online (room exists), false otherwise.
const sendRealTimeNotification = (io, userId, notificationData) => {
  const recipientRoom = `user_${userId}`;
  io.to(recipientRoom).emit('new_notification', notificationData);
  // Check if anyone is actually in the room
  return io.sockets.adapter.rooms.has(recipientRoom);
};



// routes/users.js
router.post("/follow/:id", auth, async (req, res) => {
  try {
    const loggedInUserId = req.user.id;
    const targetUserId = req.params.id;
    const io = req.app.get('io');

    if (loggedInUserId === targetUserId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    // 1. Try to atomically add the target user to the logged-in user's following list.
    // If targetUserId is not already in the array, the filter matches and pushes it.
    const loggedInUser = await User.findOneAndUpdate(
      { _id: loggedInUserId, following: { $ne: targetUserId } },
      { $addToSet: { following: targetUserId } },
      { new: true, select: 'following username profileImage' }
    );

    let isFollowing;
    let updatedFollowerCount;

    if (loggedInUser) {
      // ---> FOLLOW ACTION <--- (User was not following previously)
      isFollowing = true;

      // 2. Add logged-in user to the target user's followers array and increment notification count
      const targetUser = await User.findOneAndUpdate(
        { _id: targetUserId },
        { 
          $addToSet: { followers: loggedInUserId },
          $inc: { unreadNotifications: 1 }
        },
        { new: true, select: 'followers' }
      );

      if (!targetUser) {
        // Rollback follow action if the target user doesn't exist
        await User.updateOne({ _id: loggedInUserId }, { $pull: { following: targetUserId } });
        return res.status(404).json({ message: "User not found" });
      }

      updatedFollowerCount = targetUser.followers.length;

      // 3. Save notification & emit socket event
      const savedNotification = await Notification.create({
        recipient: targetUserId,
        sender: loggedInUserId,
        type: 'follow'
      });

      const notificationData = {
        _id: savedNotification._id,
        type: 'follow',
        sender: {
          _id: loggedInUser._id,
          username: loggedInUser.username,
          profileImage: loggedInUser.profileImage
        },
        createdAt: savedNotification.createdAt,
        read: false
      };
      sendRealTimeNotification(io, targetUserId, notificationData);

    } else {
      // ---> UNFOLLOW ACTION <--- (User was already following target)
      isFollowing = false;

      // Remove from both lists atomically
      const [_, updatedTargetUser] = await Promise.all([
        User.findOneAndUpdate(
          { _id: loggedInUserId },
          { $pull: { following: targetUserId } }
        ),
        User.findOneAndUpdate(
          { _id: targetUserId },
          { $pull: { followers: loggedInUserId } },
          { new: true, select: 'followers' }
        )
      ]);

      if (!updatedTargetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      updatedFollowerCount = updatedTargetUser.followers.length;
    }

    res.json({
      success: true,
      isFollowing,
      updatedFollowerCount,
    });

  } catch (error) {
    console.error("Follow/Unfollow error:", error);
    res.status(500).json({ message: "Server error" });
  }
});



// Get unread notifications
// In your notification fetching route
router.get('/notifications/unread', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user.id,
      read: false
    })
    .populate('sender', 'username profileImage') // Populate sender with needed fields
    .populate('post', 'media') // Populate post with media
    .sort({ createdAt: -1 });

    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Mark notifications as read
// Mark notifications as read
router.patch('/notifications/mark-read/:id', auth, async (req, res) => {
  try {
   

    // Debug the query parameters
   
    
    // Count unread notifications before update
    const beforeCount = await Notification.countDocuments({
      recipient: req.user.id,
      read: false
    });
    

    // Update all unread notifications
    const updateResult = await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    

    // Verify the update
    const afterCount = await Notification.countDocuments({
      recipient: req.user.id,
      read: false
    });

    // Update user's unread count
    const userBefore = await User.findById(req.user.id).select('unreadNotifications');
    

    const userUpdate = await User.findByIdAndUpdate(
      req.user.id,
      { unreadNotifications: 0 },
      { new: true }
    );
   

    // Debug response
    
    const response = { 
      success: true,
      stats: {
        notificationsMarked: updateResult.modifiedCount,
        previousUnreadCount: userBefore.unreadNotifications
      }
    };

    res.json(response);

  } catch (error) {

    
    res.status(500).json({ 
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.post('/actions', auth, [
  check('postId', 'Post ID is required').not().isEmpty(),
  check('actionType', 'Valid action type is required').isIn(['like', 'unlike', 'comment'])
], async (req, res) => {
  console.log('--- STARTING ACTION PROCESSING ---');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Authenticated user ID:', req.user.id);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { postId, actionType, commentText } = req.body;
  const senderId = req.user.id;
  const io = req.app.get('io');


  const sender = await User.findById(senderId);
            if (!sender) {
              console.error('Sender user not found');
              return res.status(404).json({ msg: 'User not found' });
            };

  try {
    console.log(`Looking for post with ID: ${postId}`);
    // First get the post with its direct fields
    const post = await Post.findById(postId);
    
    if (!post) {
      console.error('Post not found with ID:', postId);
      return res.status(404).json({ msg: 'Post not found' });
    }


    
    // Then get the user's unreadNotifications separately
    const user = await User.findById(post.userId)
      .select('unreadNotifications');

    const recipientId = post.userId;
    const isSelfAction = senderId.toString() === recipientId.toString();
    console.log(`Action details - Sender: ${senderId}, Recipient: ${recipientId}, IsSelfAction: ${isSelfAction}`);

    switch (actionType) {
      case 'like':
        console.log('Processing LIKE action...');
        const updatedPost = await Post.findOneAndUpdate(
          { _id: postId, likes: { $ne: senderId } },
          { $addToSet: { likes: senderId } },
          { new: true }
        );

        if (!updatedPost) {
          console.log('User already liked this post or post not found');
          return res.status(400).json({ msg: 'Post already liked' });
        }

        console.log('Post liked successfully. Updated likes:', updatedPost.likes);

        if (!isSelfAction) {
          console.log('Creating like notification...');

          // Always save to DB first so notification persists
          const savedNotification = await Notification.create({
            recipient: recipientId,
            sender: sender._id,
            type: 'like',
            post: updatedPost._id
          });
          await User.findByIdAndUpdate(recipientId, {
            $inc: { unreadNotifications: 1 }
          });

          // Then attempt real-time delivery with populated sender data
          const notificationData = {
            _id: savedNotification._id,
            type: 'like',
            sender: {
              _id: sender._id,
              username: sender.username,
              profileImage: sender.profileImage
            },
            post: { _id: updatedPost._id, media: updatedPost.media },
            createdAt: savedNotification.createdAt,
            read: false
          };
          sendRealTimeNotification(io, recipientId, notificationData);
          console.log('Like notification saved and real-time delivery attempted');
        }

        return res.json({ 
          msg: 'Post liked', 
          likes: updatedPost.likes,
          username: updatedPost.username // From Post schema
        });

      case 'unlike':
        console.log('Processing UNLIKE action...');
        const unlikedPost = await Post.findOneAndUpdate(
          { _id: postId, likes: senderId },
          { $pull: { likes: senderId } },
          { new: true }
        );

        if (!unlikedPost) {
          console.log('User has not liked this post yet or post not found');
          return res.status(400).json({ msg: 'Post not liked yet' });
        }

        console.log('Post unliked successfully. Updated likes:', unlikedPost.likes);

        if (!isSelfAction) {
          console.log('Removing like notification...');
          const result = await Notification.deleteOne({
            recipient: recipientId,
            sender: sender._id,
            type: 'like',
            post: unlikedPost._id
          });
          console.log('Notification deletion result:', result);
        }

        return res.json({ 
          msg: 'Post unliked', 
          likes: unlikedPost.likes,
          username: unlikedPost.username // From Post schema
        });

        case 'comment':
          console.log('Processing COMMENT action...');
          if (!commentText || commentText.trim() === '') {
            console.error('Empty comment text received');
            return res.status(400).json({ msg: 'Comment text is required' });
          }
        
          try {
            // Create properly structured comment
            const newComment = {
              text: commentText.trim(),
              userId: sender._id, // Use the actual ObjectId
              username: sender.username, // Verified username from DB
              profileImage: sender.profileImage, // Make sure this field exists
              createdAt: new Date()
            };
        
            // Add comment to post atomically
            const updatedPost = await Post.findOneAndUpdate(
              { _id: postId },
              { $push: { comments: newComment } },
              { new: true }
            );

            if (!updatedPost) {
              return res.status(404).json({ msg: 'Post not found' });
            }
            
            console.log('Comment added to post. Total comments:', updatedPost.comments.length);
            const newCommentId = updatedPost.comments[updatedPost.comments.length - 1]._id;
        
            // Notification handling (unchanged)
            if (!isSelfAction) {
              console.log('Creating comment notification...');

              // Always save to DB first so notification persists
              const savedNotification = await Notification.create({
                recipient: recipientId,
                sender: sender._id,
                type: 'comment',
                post: updatedPost._id,
                commentId: newCommentId
              });
              await User.findByIdAndUpdate(recipientId, {
                $inc: { unreadNotifications: 1 }
              });

              // Then attempt real-time delivery with populated sender data
              const notificationData = {
                _id: savedNotification._id,
                type: 'comment',
                sender: {
                  _id: sender._id,
                  username: sender.username,
                  profileImage: sender.profileImage
                },
                post: { _id: updatedPost._id, media: updatedPost.media },
                commentId: newCommentId,
                createdAt: savedNotification.createdAt,
                read: false
              };
              sendRealTimeNotification(io, recipientId, notificationData);
            }
        
            // Return the populated comment
            const populatedPost = await Post.findById(postId)
              .populate({
                path: 'comments.userId',
                select: 'username profileImage'
              });
        
            return res.json({
              msg: 'Comment added',
              comment: populatedPost.comments.id(newCommentId),
              comments: populatedPost.comments,
              username: updatedPost.username
            });
        
          } catch (err) {
            console.error('Error processing comment:', err);
            return res.status(500).json({ msg: 'Error adding comment' });
          }
      default:
        console.error('Invalid action type received:', actionType);
        return res.status(400).json({ msg: 'Invalid action type' });
    }
  } catch (err) {
    console.error('!!! ERROR IN ACTION PROCESSING !!!');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('Full error object:', err);
    
    res.status(500).send('Server Error');
  } finally {
    console.log('--- ACTION PROCESSING COMPLETED ---');
  }
});

router.get('/:postId/like-status', auth, async (req, res) => {
  try {
    console.log('Starting /:postId/like-status endpoint');
    console.log('Authenticated user ID:', req.user?.id);
    
    const postId = req.params.postId;
    const userId = req.user.id;
    
    console.log(`Checking like status for post ${postId} and user ${userId}`);
    
    // Find the post and include the likes array
    const post = await Post.findById(postId)
      .select('likes likeCount');
    
    if (!post) {
      console.log(`Post with ID ${postId} not found`);
      return res.status(404).json({ message: "Post not found" });
    }
    
    // Check if user exists in the post's likes array
    const isLiked = post.likes.some(like => like.equals(userId));
    console.log('Like exists check result:', isLiked);
    console.log('Retrieved post likeCount:', post.likeCount);
    
    res.json({ 
      isLiked: isLiked,
      likeCount: post.likeCount 
    });
    
    console.log('Successfully completed like-status request');
  } catch (error) {
    console.error('Error in /:postId/like-status:', error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all notifications (both read and unread)
router.get('/notifications/all', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user.id
    })
    .populate('sender', 'username profileImage')
    .populate('post', 'media')
    .sort({ createdAt: -1 });

    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;


const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/users');
const multer = require('multer');
const { uploadMedia } = require('../config/cloudinary');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// GET /api/chats - Fetch all conversations for logged-in user
router.get('/chats', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      participants: userId
    })
      .populate('participants', 'name username profileImage institute')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name username' }
      })
      .sort({ updatedAt: -1 });

    const formattedChats = conversations.map(chat => {
      const recipient = chat.participants.find(
        p => p._id.toString() !== userId.toString()
      );
      const unread = chat.unreadCounts ? (chat.unreadCounts.get(userId.toString()) || 0) : 0;

      return {
        _id: chat._id,
        recipient: recipient || chat.participants[0],
        participants: chat.participants,
        lastMessage: chat.lastMessage,
        unreadCount: unread,
        updatedAt: chat.updatedAt
      };
    });

    res.json(formattedChats);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Failed to fetch conversations' });
  }
});

// GET /api/chats/unread-count - Total unread message count across all conversations
router.get('/chats/unread-count', auth, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const conversations = await Conversation.find({ participants: userId });

    let totalUnread = 0;
    conversations.forEach(chat => {
      if (chat.unreadCounts && chat.unreadCounts.has(userId)) {
        totalUnread += chat.unreadCounts.get(userId) || 0;
      }
    });

    res.json({ unreadCount: totalUnread });
  } catch (error) {
    console.error('Error fetching total unread chat count:', error);
    res.status(500).json({ unreadCount: 0 });
  }
});

// POST /api/chats/find-or-create - Find or create 1-on-1 chat with recipient
router.post('/chats/find-or-create', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { recipientId } = req.body;

    if (!recipientId) {
      return res.status(400).json({ message: 'Recipient ID is required' });
    }

    if (recipientId === userId.toString()) {
      return res.status(400).json({ message: 'Cannot chat with yourself' });
    }

    // Check if recipient exists
    const recipientUser = await User.findById(recipientId).select('name username profileImage institute');
    if (!recipientUser) {
      return res.status(404).json({ message: 'Recipient user not found' });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [userId, recipientId], $size: 2 }
    })
      .populate('participants', 'name username profileImage institute')
      .populate('lastMessage');

    if (!conversation) {
      conversation = new Conversation({
        participants: [userId, recipientId],
        unreadCounts: new Map()
      });
      await conversation.save();
      await conversation.populate('participants', 'name username profileImage institute');
    }

    const recipient = conversation.participants.find(
      p => p._id.toString() !== userId.toString()
    );

    res.json({
      _id: conversation._id,
      recipient: recipient || recipientUser,
      participants: conversation.participants,
      lastMessage: conversation.lastMessage,
      unreadCount: conversation.unreadCounts ? (conversation.unreadCounts.get(userId.toString()) || 0) : 0,
      updatedAt: conversation.updatedAt
    });
  } catch (error) {
    console.error('Error finding or creating chat:', error);
    res.status(500).json({ message: 'Failed to access conversation' });
  }
});

// GET /api/chats/:chatId/messages - Fetch message history for a conversation
router.get('/chats/:chatId/messages', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.params;

    const conversation = await Conversation.findById(chatId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check authorization
    const isParticipant = conversation.participants.some(
      p => p.toString() === userId.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Reset unread count for this user
    if (conversation.unreadCounts && conversation.unreadCounts.get(userId.toString())) {
      conversation.unreadCounts.set(userId.toString(), 0);
      await conversation.save();
    }

    const messages = await Message.find({ conversationId: chatId })
      .populate('sender', 'name username profileImage')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// POST /api/chats/:chatId/messages - Post message via HTTP (with optional image)
router.post('/chats/:chatId/messages', auth, upload.single('media'), async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.params;
    const { text } = req.body;

    const conversation = await Conversation.findById(chatId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isParticipant = conversation.participants.some(
      p => p.toString() === userId.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let mediaUrl = '';
    if (req.file) {
      mediaUrl = await uploadMedia(req.file, 'uploads');
    }

    if (!text && !mediaUrl) {
      return res.status(400).json({ message: 'Message text or media is required' });
    }

    const newMessage = new Message({
      conversationId: chatId,
      sender: userId,
      text: text || '',
      mediaUrl: mediaUrl || '',
      readBy: [userId]
    });

    await newMessage.save();
    await newMessage.populate('sender', 'name username profileImage');

    // Update conversation lastMessage and unread counts for recipients
    conversation.lastMessage = newMessage._id;
    
    if (!conversation.unreadCounts) {
      conversation.unreadCounts = new Map();
    }
    
    conversation.participants.forEach(participantId => {
      const pIdStr = participantId.toString();
      if (pIdStr !== userId.toString()) {
        const currentUnread = conversation.unreadCounts.get(pIdStr) || 0;
        conversation.unreadCounts.set(pIdStr, currentUnread + 1);
      }
    });

    await conversation.save();

    // Broadcast via Socket.io if available
    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('receive_message', newMessage);

      // Notify recipients for unread count increment
      conversation.participants.forEach(participantId => {
        const pIdStr = participantId.toString();
        if (pIdStr !== userId.toString()) {
          io.to(`user_${pIdStr}`).emit('unread_chat_update', {
            chatId,
            unreadCount: conversation.unreadCounts.get(pIdStr)
          });
        }
      });
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

// PUT /api/chats/:chatId/read - Mark messages in conversation as read
router.put('/chats/:chatId/read', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.params;

    const conversation = await Conversation.findById(chatId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    if (conversation.unreadCounts && conversation.unreadCounts.get(userId.toString()) !== 0) {
      conversation.unreadCounts.set(userId.toString(), 0);
      await conversation.save();
    }

    await Message.updateMany(
      { conversationId: chatId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId.toString()}`).emit('unread_chat_update', {
        chatId,
        unreadCount: 0
      });
    }

    res.json({ message: 'Marked as read' });
  } catch (error) {
    console.error('Error marking chat as read:', error);
    res.status(500).json({ message: 'Failed to mark as read' });
  }
});

module.exports = router;

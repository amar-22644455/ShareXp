const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/users');
const bcrypt = require("bcryptjs");
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if(!email){
    return res.status(400).json({ message: '"email" is required' });
  }
  if(!password){
    return res.status(400).json({ message: '"password" is required' });
  }
  // Find the user by email
  const user = await User.findOne({ email });
  // If the user doesn't exist or the password is incorrect, return a generic error
  if(!user){
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  const validPassword = await bcrypt.compare(password, user.password)
  if (!validPassword) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  // Generate a JWT token with the user ID as payload and 7-day expiration
  const token = jwt.sign({ id : user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  // Set httpOnly strict sameSite cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
  });

  // Return only non-sensitive user info. The JWT is delivered via the httpOnly
  // cookie above — do NOT include it in the response body (XSS-safe).
  res.json({ user: { id: user._id, name: user.name, username: user.username } });
});

router.post('/auth/guest-login', async (req, res) => {
  try {
    const guestEmail = 'guest@sharexp.com';
    let guestUser = await User.findOne({ email: guestEmail });

    if (!guestUser) {
      guestUser = new User({
        name: 'Guest Explorer',
        username: 'guest_user',
        email: guestEmail,
        password: 'guestpassword123',
        institute: 'IIT Patna',
        mobile: '9999999999',
        description: 'Exploring ShareXP as a Guest User 🚀'
      });
      await guestUser.save();
    }

    const token = jwt.sign({ id: guestUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      user: {
        id: guestUser._id,
        name: guestUser.name,
        username: guestUser.username
      }
    });
  } catch (err) {
    console.error('Guest login error:', err);
    res.status(500).json({ message: 'Guest login failed' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  res.json({ message: 'Logged out successfully' });
});

router.get('/auth/me', auth, async (req, res) => {
  // User is already verified and attached to req.user by the auth middleware
  res.json({ id: req.user._id, name: req.user.name, username: req.user.username });
});

module.exports = router;
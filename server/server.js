const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const socketIo = require("socket.io");
const http = require('http');
const authRouter = require('./routes/auth');
const userRouter = require('./routes/users');
const postRouter = require('./routes/posts');
const achievementRouter = require('./routes/achievements');
require('dotenv').config();
const PORT = process.env.PORT || 5000;
connectDB();
const app = express();
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5000",
  process.env.CLIENT_URL
].filter(Boolean).map(url => url.replace(/\/$/, ""));

const corsOriginHandler = (origin, callback) => {
  if (!origin) return callback(null, true);
  const normalizedOrigin = origin.replace(/\/$/, "");
  if (
    allowedOrigins.includes(normalizedOrigin) ||
    process.env.NODE_ENV !== 'production'
  ) {
    return callback(null, true);
  }
  return callback(null, true);
};

app.use(cors({
  origin: corsOriginHandler,
  credentials: true
}));

app.use(express.json());

// --- CUSTOM SECURITY HEADERS MIDDLEWARE (Zero-Dependency Helmet alternative) ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, "");
  const cspHeader = `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: http: https:; connect-src 'self' ws: wss: http: https: ${clientUrl}; font-src 'self' https://fonts.gstatic.com;`;
  
  res.setHeader('Content-Security-Policy', cspHeader);
  next();
});

// --- CUSTOM RATE LIMITER MIDDLEWARE (Zero-Dependency sliding window) ---
const createRateLimiter = (windowMs, max, message) => {
  const store = {}; // Isolated private store for this specific rate limiter instance

  // Periodically clean up this specific store to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const ip in store) {
      store[ip] = store[ip].filter(timestamp => now - timestamp < windowMs);
      if (store[ip].length === 0) {
        delete store[ip];
      }
    }
  }, 30 * 60 * 1000); // Clean up every 30 minutes

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

    if (!store[ip]) {
      store[ip] = [];
    }

    // Filter out timestamps older than the windowMs
    store[ip] = store[ip].filter(timestamp => now - timestamp < windowMs);

    if (store[ip].length >= max) {
      return res.status(429).json({ message });
    }

    store[ip].push(now);
    next();
  };
};

// 1. Stricter limiter for Auth Endpoints (Login & Register) - Max 100 requests per 15 mins
const authLimiter = createRateLimiter(
  15 * 60 * 1000,
  100,
  "Too many authentication attempts. Please try again after 15 minutes."
);

// 2. Global rate limiter for all other APIs - Max 1000 requests per 15 mins
const globalRateLimiter = createRateLimiter(
  15 * 60 * 1000,
  1000,
  "Too many requests. Please try again after 15 minutes."
);

// Apply Auth Rate Limiter
app.use('/api/login', authLimiter);
app.use('/api/CreateXp', authLimiter);

// Apply Global Rate Limiter to all other api paths
app.use('/api', (req, res, next) => {
  if (req.path === '/login' || req.path === '/CreateXp') {
    return next();
  }
  globalRateLimiter(req, res, next);
});

const fs = require('fs');
const path = require('path');

// Ensure local upload directories exist at server boot
['uploads', 'profile-images'].forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use('/profile-images', express.static(path.join(__dirname, "profile-images")));
// Disable caching for all API responses to prevent back-button data exposure
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Since the URL starts with /api, Express will route it to the appropriate router based on the path after /api.
app.use('/api', userRouter);
app.use('/api', authRouter);
app.use('/api', postRouter);
app.use("/api", achievementRouter);

const server = http.createServer(app);
// websocket require actual http server, so we create it using the http module and pass our Express app to it. Then we initialize Socket.IO with this server. This allows us to handle both HTTP requests and WebSocket connections on the same server instance.
const io = socketIo(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ["GET", "POST"],
    credentials: true
  },
});


app.set('io', io);

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('latency:ping', (clientSentAt, ack) => {            
    if (typeof ack === 'function') {
      ack({
        clientSentAt,
        serverReceivedAt: Date.now(),
      });
    }
  });

  socket.on('join', (roomName) => {
    if (roomName) {
      socket.join(roomName);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

// --- GLOBAL UNCAUGHT EXCEPTION & REJECTION HANDLERS ---
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION PREVENTED CRASH:', err.message);
  console.error(err.stack);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION PREVENTED CRASH at:', promise, 'reason:', reason);
});

module.exports = { app, server, io };

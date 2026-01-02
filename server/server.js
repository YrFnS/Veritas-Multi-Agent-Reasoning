import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables FIRST before any other imports
const envPath = join(__dirname, '.env');
console.log('📁 Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  // Silent error in production (env vars provided by host)
  if (process.env.NODE_ENV !== 'production') {
    console.error('❌ Error loading .env:', result.error);
  }
} else {
  console.log('✅ .env loaded successfully');
}

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import FileStoreFactory from 'session-file-store';
import cookieSession from 'cookie-session';
import authRouter from './routes/auth.js';
import geminiRouter from './routes/gemini.js';

const FileStore = FileStoreFactory(session);

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// CORS configuration - allow credentials for session cookies
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parser
app.use(express.json());

// Session configuration
// PROD: Use cookie-session (stateless, good for serverless)
// DEV: Use express-session + file-store (easy debugging)
if (IS_PRODUCTION) {
  console.log('🔒 Using cookie-session for production');
  app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'default_secret'], // Rotatable keys
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }));

  // Compatibility middleware to make cookie-session look like express-session
  app.use((req, res, next) => {
    if (req.session) {
      // express-session compatibility
      const oldDestroy = req.session.destroy; // cookie-session doesn't have destroy
      req.session.destroy = (callback) => {
        req.session = null;
        if (callback) callback();
      };
    }
    next();
  });
} else {
  console.log('📂 Using file-store for local development');
  app.use(session({
    store: new FileStore({
      path: join(__dirname, 'sessions'),
      ttl: 7 * 24 * 60 * 60, // 7 days in seconds
      retries: 0,
      logFn: () => { } // Suppress verbose logging
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Allow HTTP for local dev
      httpOnly: true, // Prevent XSS attacks
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  }));
}

// Routes
app.use('/auth', authRouter);
app.use('/api', geminiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// START SERVER ONLY IF DIRECTLY RUN (not imported as module)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`🚀 Veritas server running on http://localhost:${PORT}`);
    console.log(`📡 CORS enabled for: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
    console.log(`🔐 Session secret: ${process.env.SESSION_SECRET ? '✓ Set' : '⚠ Using default (insecure)'}`);
  });
}

// Export app for serverless wrapper
export const handler = app;
export default app;

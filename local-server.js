import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';

// Import our serverless handlers and wrap them for Express
import eventsHandler from './api/events.js';
import payHandler from './api/pay.js';
import authHandler from './api/auth.js';
import adminHandler from './api/admin.js';
import contactHandler from './api/contact.js';

const app = express();

// Request Logger
app.use((req, res, next) => {
    console.log(`${new Date().toLocaleTimeString()} | ${req.method} ${req.path}`);
    next();
});

app.use(cors({
    origin: true, // Allow all origins for local mobile development
    credentials: true
}));

// Use express.raw so getBody() inside our serverless handlers works properly (it expects a stream/buffer)
app.use(express.raw({ type: '*/*', limit: '50mb' }));

// A simple wrapper to make Express acts like a Vercel serverless request/response
const vercelWrapper = (handler) => async (req, res) => {
    try {
        await handler(req, res);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Fail' });
    }
};

// Fix routing so req.url is exactly what the serverless functions expect
app.use((req, res, next) => {
    if (
        req.path.startsWith('/api/events') || 
        req.path.startsWith('/api/discussions') || 
        req.path.startsWith('/api/health')
    ) return vercelWrapper(eventsHandler)(req, res);
    if (req.path.startsWith('/api/contact')) return vercelWrapper(contactHandler)(req, res);
    if (req.path.startsWith('/api/pay') || req.path.startsWith('/api/booking')) return vercelWrapper(payHandler)(req, res);
    if (req.path.startsWith('/api/auth')) return vercelWrapper(authHandler)(req, res);
    if (req.path.startsWith('/api/admin')) return vercelWrapper(adminHandler)(req, res);
    next();
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`\n======================================`);
    console.log(`✅ LOCAL NEXUS BACKEND ACTIVE on PORT ${PORT}`);
    console.log(`======================================\n`);
    console.log(`To connect your local apps to this server:`);
    console.log(`1. In Events/.env, add: REACT_APP_API_BASE_URL=http://localhost:3001`);
    console.log(`2. In AdminPanel/.env.local, add: VITE_API_URL=http://localhost:3001`);
});

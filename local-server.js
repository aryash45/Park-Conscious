import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

import express from 'express';
import cors from 'cors';

// Import our serverless handlers and wrap them for Express
import eventsHandler from './api/events.js';
import payHandler from './api/pay.js';
import authHandler from './api/auth.js';
import adminHandler from './api/admin.js';
import contactHandler from './api/contact.js';
import sitemapHandler from './api/sitemap.xml.js';
import robotsHandler from './api/robots.js';

// BullMQ & Monitoring
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { ticketQueue } from './api/lib/queue.js';
import { initWorker } from './api/lib/worker.js';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/admin/queues');

createBullBoard({
    queues: ticketQueue ? [new BullMQAdapter(ticketQueue)] : [],
    serverAdapter: serverAdapter,
});

// Start Background Worker
try {
    initWorker();
} catch (error) {
    console.error(`[WORKER_INIT_ERROR]: Failed to initialize background worker.`, error);
}

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

// Access Control for Admin Tools
const isLocalOrAuth = (req, res, next) => {
    const remoteAddress = req.socket.remoteAddress;
    const isLocal = remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1';
    
    // Also check for a secret header if provided via env
    const adminSecret = process.env.ADMIN_DASHBOARD_SECRET;
    const providedSecret = req.headers['x-admin-secret'];
    const isAuthorized = adminSecret && providedSecret === adminSecret;

    if (isLocal || isAuthorized) {
        return next();
    }
    
    console.warn(`[UNAUTHORIZED_ACCESS]: Blocked request to admin tools from ${remoteAddress}`);
    res.status(403).send('Forbidden: Admin access restricted to local or authorized clients.');
};

// Monitoring Dashboard (Mounted BEFORE raw body parser to avoid issues)
app.use('/api/admin/queues', isLocalOrAuth, serverAdapter.getRouter());

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
    if (req.path === '/api/sitemap.xml' || req.path === '/api/sitemap.xml/') return vercelWrapper(sitemapHandler)(req, res);
    if (req.path === '/api/robots.txt' || req.path === '/api/robots.js') return vercelWrapper(robotsHandler)(req, res);
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

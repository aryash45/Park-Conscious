/**
 * api/auth.js
 * 
 * Purpose: Handles authentication operations including traditional login 
 * (with fail-over to secondary databases), logout (global cookie clearing), 
 * Google OAuth integration, and session verification (/me).
 * Includes security logic to prevent public users from accessing admin portals.
 */
import connectDB from './lib/mongodb.js';
import * as models from './lib/models.js';
import bcrypt from 'bcryptjs';
import { serialize } from 'cookie';
import { json, setCors, getBody, verifyUser, issueCookie } from './lib/utils.js';
import { syncIdentity } from './lib/sync.js';
import { sendOTPEmail } from './lib/email.js';

const { User, Owner, VerificationCode } = models;

export default async function handler(req, res) {
    setCors(req, res);
    if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }

    const fullUrl = req.url || '/';
    const [pathPart, queryPart] = fullUrl.split('?');
    const url = pathPart.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    const method = req.method || 'GET';
    const body = await getBody(req);
    const user = verifyUser(req);

    try {
        await connectDB();
        
        // -- Login --
        if ((url.includes('/login') || url.endsWith('/auth/login')) && method === 'POST') {
            const { email, password } = body;
            const search = (email || '').toLowerCase().trim();
            
            // Priority: Check Primary Database
            let u = await Owner.findOne({ email: search });
            let isOwner = !!u;
            console.log(`[AUTH_DEBUG]: Search for ${search} | Found in Primary: ${!!u}`);
            
            if (!u) {
                u = await User.findOne({ email: search });
                isOwner = false;
            }

            // Step 2: Fail-over to Secondary Database if not found
            if (!u) {
                const SecOwner = models.getSecondaryModel('Owner');
                const SecUser = models.getSecondaryModel('User');
                
                u = await SecOwner.findOne({ email: search });
                isOwner = !!u;
                if (!u) {
                    u = await SecUser.findOne({ email: search });
                    isOwner = false;
                }
            }

            if (!u) return json(res, 401, { message: 'Invalid credentials' });
            if (u.password && !await bcrypt.compare(password, u.password)) {
                return json(res, 401, { message: 'Invalid credentials' });
            }
            
            const payload = { 
                id: String(u._id), 
                uid: String(u._id),
                name: u.name, 
                email: u.email, 
                role: isOwner ? (u.role || 'organizer').toLowerCase() : 'user' 
            };
            const token = issueCookie(req, res, payload);
            return json(res, 200, { user: payload, token });
        }

        // -- Logout --
        if (url.includes('/logout') && method === 'POST') {
            // Unconditionally clear from the root domain and the host
            const rootDomain = '.parkconscious.in';
            const clearHeaders = [
                serialize('token', '', { httpOnly: true, secure: true, sameSite: 'lax', domain: rootDomain, maxAge: -1, path: '/' }),
                serialize('token', '', { httpOnly: true, secure: true, sameSite: 'lax', maxAge: -1, path: '/' })
            ];

            res.setHeader('Set-Cookie', clearHeaders);
            return json(res, 200, { message: 'Logged out successfully globally' });
        }

        // -- Google Auth --
        if (url.includes('/google') && method === 'POST') {
            const { credential } = body;
            if (!credential) return json(res, 400, { message: 'Credential (ID Token) required' });
            
            let payload;
            try {
                const googleClientId = process.env.GOOGLE_CLIENT_ID;
                if (!googleClientId) {
                    console.error('[SECURITY]: GOOGLE_CLIENT_ID is missing from environment.');
                    return json(res, 500, { message: 'Internal Server Error: Google OAuth not configured.' });
                }

                const { OAuth2Client } = await import('google-auth-library');
                const client = new OAuth2Client(googleClientId);
                const ticket = await client.verifyIdToken({
                    idToken: credential,
                    audience: googleClientId
                });
                payload = ticket.getPayload();
                
                if (!payload || !payload.email) {
                    return json(res, 401, { message: 'Invalid Google Credential: Email missing' });
                }
            } catch (err) {
                console.error('[GOOGLE_VERIFY_ERROR]:', err.message);
                return json(res, 401, { message: 'Invalid Google Credential' });
            }

            const { email, name, sub: googleId, picture } = payload;
            const search = email.toLowerCase();
            
            // Step 1: Try Primary
            let u = await Owner.findOne({ email: search });
            let isOwner = !!u;
            
            if (!u) {
                u = await User.findOne({ email: search });
                isOwner = false;
            }

            // Step 2: Try Secondary
            if (!u) {
                const SecOwner = models.getSecondaryModel('Owner');
                const SecUser = models.getSecondaryModel('User');

                u = await SecOwner.findOne({ email: search });
                isOwner = !!u;
                if (!u) {
                    u = await SecUser.findOne({ email: search });
                    isOwner = false;
                }
            }

            if (!u) {
                // If brand new, create in the primary database
                u = await User.create({ name, email: search, googleId, picture });
                isOwner = false;
            } else {
                // SECURITY: Prevent unauthorized account binding/hijacking
                if (u.googleId && u.googleId !== googleId) {
                    console.warn(`[AUTH_HIJACK_ATTEMPT]: User ${search} attempted Google login with different googleId.`);
                    return json(res, 403, { 
                        message: 'This account is already linked to a different Google identity. Please log in with your password or contact support.' 
                    });
                }

                if (!u.googleId) {
                    // REQUIRE VERIFICATION for binding Google to an existing password-based account
                    // For now, we reject to prevent auto-binding without a verification flow
                    console.info(`[AUTH_BIND_REQUIRED]: User ${search} attempted Google login but account is password-only.`);
                    return json(res, 401, { 
                        message: 'This account was created with a password. Please sign in using your email and password, or contact support if you wish to link your Google account.' 
                    });
                }

                let changed = false;
                // Unconditional name sync
                if (u.name !== name) {
                    u.name = name;
                    changed = true;
                }
                // Sync picture if available
                if (picture && u.picture !== picture) {
                    u.picture = picture;
                    changed = true;
                }
                if (changed) await u.save();
            }

            // Sync identity to Park Conscious database in the background
            await syncIdentity(u, isOwner);

            const userPayload = { 
                id: String(u._id), 
                uid: String(u._id), 
                name: u.name, 
                email: u.email, 
                picture: u.picture || "",
                role: isOwner ? (u.role || 'organizer').toLowerCase() : 'user' 
            };
            const token = issueCookie(req, res, userPayload);
            return json(res, 200, { user: userPayload, token, message: 'Logged in with Google (Verified)' });
        }

        // -- Session Check --
        if (url.includes('/me') && method === 'GET') {
            const decoded = verifyUser(req);
            if (!decoded) return json(res, 401, { authenticated: false });
            
            const host = req.headers.host || '';
            const isAdminHost = host.includes('admin.events');
            
            // Firewall: Ensure the user's role matches the portal they are accessing
            const isPortalAdmin = decoded.role === 'admin' || decoded.role === 'superadmin' || decoded.role === 'organizer' || decoded.role === 'owner';
            
            if (!isPortalAdmin && isAdminHost) {
                return json(res, 401, { authenticated: false, message: 'Public sessions not allowed on admin portal' });
            }

            return json(res, 200, { authenticated: true, user: decoded });
        }

        // -- Organizer Registration (Self-Service with OTP) --
        if (url.includes('/register/send-otp') && method === 'POST') {
            const { email } = body;
            if (!email) return json(res, 400, { message: 'Email required' });

            const search = email.toLowerCase().trim();
            const existing = await Owner.findOne({ email: search });
            if (existing) {
                // Prevent email enumeration by returning a generic success message
                return json(res, 200, { success: true, message: 'If the email is valid, an OTP has been sent.' });
            }

            // Generate 6-digit OTP
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            await VerificationCode.findOneAndUpdate(
                { email: search },
                { code, expiresAt },
                { upsert: true, new: true }
            );

            // SEND OTP EMAIL (Multi-Provider)
            await sendOTPEmail(search, code);
            
            return json(res, 200, { success: true, message: 'Verification code sent.' });
        }

        if (url.includes('/register/verify-otp') && method === 'POST') {
            const { email, code } = body;
            if (!email || !code) return json(res, 400, { message: 'Missing email or code' });

            const search = email.toLowerCase().trim();
            const verification = await VerificationCode.findOne({ email: search, code });
            
            if (!verification) return json(res, 400, { message: 'Invalid or expired verification code' });
            if (verification.expiresAt < new Date()) return json(res, 400, { message: 'Verification code expired' });

            return json(res, 200, { success: true, message: 'OTP verified successfully.' });
        }

        if (url.includes('/register/organizer') && method === 'POST') {
            const { name, email, password, code } = body;
            if (!name || !email || !password || !code) return json(res, 400, { message: 'Missing required fields' });

            const search = email.toLowerCase().trim();
            
            // Validate OTP
            const verification = await VerificationCode.findOne({ email: search, code });
            if (!verification || verification.expiresAt < new Date()) {
                return json(res, 400, { message: 'Invalid or expired verification code' });
            }

            const existing = await Owner.findOne({ email: search });
            if (existing) return json(res, 400, { message: 'Account with this email already exists' });

            const hashedPassword = await bcrypt.hash(password, 10);
            const newOrganizer = await Owner.create({
                name,
                email: search,
                password: hashedPassword,
                role: 'organizer'
            });

            // Cleanup OTP
            await VerificationCode.deleteOne({ _id: verification._id });

            // Sync identity to Park Conscious database
            await syncIdentity(newOrganizer, true);

            return json(res, 201, { 
                success: true, 
                message: 'Organizer account created successfully',
                user: { id: newOrganizer._id, name, email: search, role: 'organizer' }
            });
        }

        // -- Legacy owner check --
        if (url.includes('/owner/check-session')) {
            const params = new URLSearchParams(queryPart || '');
            const email = params.get('email');
            const owner = await Owner.findOne({ email: email?.toLowerCase() });
            if (!owner) return json(res, 404, { message: 'NotFound' });
            return json(res, 200, { user: { id: owner._id, name: owner.name, email: owner.email } });
        }

        return json(res, 404, { message: 'Auth endpoint not matched: ' + url });
    } catch (err) {
        if (err.missingConfig) {
             return json(res, 200, { authenticated: false, missingConfig: true, message: 'Database Connection Missing' });
        }
        console.error('[AUTH ERROR]:', err);
        return json(res, 500, { message: 'Internal Server Error', error: err.message });
    }
}

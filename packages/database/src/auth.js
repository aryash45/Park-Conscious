/**
 * api/lib/auth.js
 * 
 * Purpose: Authentication middleware for API routes.
 * Extracts and verifies JWT tokens from the 'Authorization: Bearer' header.
 */
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn("JWT_SECRET is not set in environment variables");
}

export function requireAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Missing or invalid authorization header" }));
    return null;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "User session expired. Please sign in again." }));
    return null;
  }
}

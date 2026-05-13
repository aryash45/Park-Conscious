#!/bin/bash

SOURCE="/Users/piyush/Desktop/Park Conscious"
DEST="/Users/piyush/Desktop/Backstage-Core"

echo "🚀 Starting Surgical Sync: STRICT WHITELIST MODE"

# 1. Clean Destination (except .git)
if [ -d "$DEST/.git" ]; then
    find "$DEST" -maxdepth 1 ! -name ".git" ! -name "." -exec rm -rf {} +
else
    rm -rf "$DEST"/*
fi

# 2. Strict Whitelist Sync
# Only copy specifically what belongs to the Backstage Engine
echo "Copying Base Files..."
rsync -a "$SOURCE/package.json" "$DEST/"
rsync -a "$SOURCE/local-server.js" "$DEST/"
rsync -a "$SOURCE/.env.example" "$DEST/"
rsync -a "$SOURCE/vercel.json" "$DEST/"

echo "Copying AdminPanel..."
rsync -a --exclude 'dist' --exclude 'node_modules' --exclude '.env.local' --exclude 'AdminPanel_new' --exclude 'AdminPanel' "$SOURCE/AdminPanel/" "$DEST/AdminPanel/"

echo "Copying Events Frontend..."
rsync -a --exclude 'node_modules' --exclude 'src/pages/custom' --exclude '.env' --exclude '.env.local' "$SOURCE/Events/" "$DEST/Events/"

echo "Copying API Backend..."
rsync -a "$SOURCE/api/" "$DEST/api/"

# 3. Branding & Redaction
echo "Redacting Parking Moduels..."

# Replace Logo
cp "$DEST/Events/public/logo.svg" "$DEST/Events/public/logo.png" 2>/dev/null || true
cp "$DEST/Events/public/logo.svg" "$DEST/Events/public/favicon.ico" 2>/dev/null || true

# Redact models.js (remove AccessLog and Parking schemas)
sed -i '' '/const accessLogSchema = new mongoose.Schema(/,/);/d' "$DEST/api/lib/models.js"
sed -i '' '/const parkingSchema = new mongoose.Schema(/,/);/d' "$DEST/api/lib/models.js"
sed -i '' 's/export const AccessLog.*//g' "$DEST/api/lib/models.js"
sed -i '' 's/export const Parking.*//g' "$DEST/api/lib/models.js"

# Redact App.js (Remove custom branding routes like Afsana/TEDx)
node -e "
const fs = require('fs');
let appStr = fs.readFileSync('$DEST/Events/src/App.js', 'utf8');
appStr = appStr.replace(/import TedxTicketsPage.*/g, '');
appStr = appStr.replace(/import AfsanaPage.*/g, '');
appStr = appStr.split('\\n').filter(line => !line.includes('/tedx-tickets') && !line.includes('/afsana-tickets')).join('\\n');
fs.writeFileSync('$DEST/Events/src/App.js', appStr);
"

# Redact admin.js (Remove parking api endpoints)
node -e "
const fs = require('fs');
let adminStr = fs.readFileSync('$DEST/api/admin.js', 'utf8');
// Fix import
adminStr = adminStr.replace(/const { Booking, Event, User, Owner, Parking } = models;/, 'const { Booking, Event, User, Owner } = models;');

// Remove Owner Dashboard Stats
let startIndex = adminStr.indexOf('// -- Owner Dashboard Stats --');
if(startIndex !== -1) {
    let endIndex = adminStr.indexOf('// -- Bulk Emailing --');
    if(endIndex !== -1) {
       adminStr = adminStr.substring(0, startIndex) + adminStr.substring(endIndex);
    }
}
fs.writeFileSync('$DEST/api/admin.js', adminStr);
"


echo "✅ Sync Structural Extraction Complete."


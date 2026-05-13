#!/bin/bash

# -- Safety Guards --
if [ -z "$SOURCE" ] || [ -z "$DEST" ]; then
    echo "❌ Error: SOURCE or DEST is not set."
    exit 1
fi

if [[ "$DEST" == "/" ]] || [[ "$DEST" == "$HOME" ]]; then
    echo "❌ Error: DEST is set to a dangerous root path."
    exit 1
fi

if [ ! -d "$SOURCE" ]; then
    echo "❌ Error: Source directory does not exist: $SOURCE"
    exit 1
fi

echo "🚀 Starting Surgical Sync: STRICT WHITELIST MODE"

# 1. Clean Destination (except .git) with safety check
if [ -d "$DEST" ]; then
    if [ -d "$DEST/.git" ]; then
        echo "Cleaning existing destination: $DEST (preserving .git)"
        find "$DEST" -maxdepth 1 ! -name ".git" ! -name "." -exec rm -rf {} +
    else
        echo "⚠️ Warning: DEST exists but is not a git repo. Proceeding with caution."
        # Extra safety: only clear if it looks like the right project
        if [ -f "$DEST/package.json" ]; then
            rm -rf "$DEST"/*
        else
            echo "❌ Error: DEST does not look like the target project (missing package.json). Aborting to prevent accidental deletion."
            exit 1
        fi
    fi
else
    echo "Creating destination directory: $DEST"
    mkdir -p "$DEST"
fi

# 2. Strict Whitelist Sync (Updated for Monorepo)
echo "Copying Base Files..."
rsync -a "$SOURCE/package.json" "$DEST/"
rsync -a "$SOURCE/local-server.js" "$DEST/"
rsync -a "$SOURCE/.env.example" "$DEST/"
rsync -a "$SOURCE/vercel.json" "$DEST/"
rsync -a "$SOURCE/turbo.json" "$DEST/"

echo "Copying Admin Workspace..."
mkdir -p "$DEST/apps/admin"
rsync -a --exclude 'node_modules' --exclude '.next' "$SOURCE/apps/admin/" "$DEST/apps/admin/"

echo "Copying Events Workspace..."
mkdir -p "$DEST/apps/events"
rsync -a --exclude 'node_modules' --exclude 'build' "$SOURCE/apps/events/" "$DEST/apps/events/"

echo "Copying API logic..."
rsync -a "$SOURCE/api/" "$DEST/api/"

echo "Copying Shared Packages..."
mkdir -p "$DEST/packages"
rsync -a --exclude 'node_modules' "$SOURCE/packages/" "$DEST/packages/"

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


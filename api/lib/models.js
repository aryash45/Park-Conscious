/**
 * api/lib/models.js
 * 
 * Purpose: Central definition of all Mongoose schemas and models.
 * Includes logic for interacting with both primary (backstage_events) 
 * and secondary (park_conscious) MongoDB databases.
 */
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: String,
    googleId: String,
    uid: String, // From Events project
    picture: String, // From Events project
  },
  { timestamps: true }
);

const ownerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: String,
    googleId: String,
    role: { type: String, default: "organizer", enum: ["superadmin", "admin", "organizer", "owner", "scanner"] },
  },
  { timestamps: true }
);

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    date: { type: String, required: false },
    isTBA: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    startTime: String,
    endTime: String,
    endDate: String,
    location: {
      name: String,
      address: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    images: [String],
    category: String,
    price: { type: Number, default: 0 },
    regularPrice: { type: Number, default: 0 },
    vipPrice: { type: Number, default: 0 },
    capacity: { type: Number, default: 0 },
    status: { type: String, default: 'draft', enum: ['draft', 'published', 'cancelled'] },
    organizerId: { type: String, default: null }, // UID of the event owner
    scannerIds: { type: [String], default: [] }, // Array of scanner UIDs assigned to this event
    requiredFields: {
      name: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      phone: { type: Boolean, default: true },
    },
    customForms: [{
      id: { type: String, required: true },
      label: { type: String, required: true },
      type: { type: String, enum: ['text', 'textarea', 'select', 'file', 'checkbox', 'link'], default: 'text' },
      required: { type: Boolean, default: false },
      options: { type: [String], default: [] } // For 'select' types; for 'link' type, options[0] is the URL
    }],
    startupFormEnabled: { type: Boolean, default: false },
    // Backward compatibility for old "Events" project fields
    name: String,
    venue: String,
    venueCity: String,
    attendees: String,
    image: String,
    badge: String,
    // Featured Event Fields
    isFeatured: { type: Boolean, default: false },
    featuredTitle: String,
    featuredSubtitle: String,
    featuredLabel: String,
    accentColor: String, // Tailwind class name like 'red-600' or 'indigo-500'
    // Media Gallery: extra photos/videos shown on the event detail page
    mediaGallery: [{
      url: { type: String, required: true },
      type: { type: String, enum: ['image', 'video'], default: 'image' }
    }],
    // New Luma-inspired fields
    hosts: [{
      name: String,
      image: String,
      socialLink: String,
      role: { type: String, default: 'Host' }
    }],
    ticketTiers: [{
      name: { type: String, required: true },
      price: { type: Number, default: 0 },
      capacity: { type: Number, default: 0 },
      requireApproval: { type: Boolean, default: false },
      description: String
    }],
    themeConfig: {
      primaryColor: { type: String, default: '#E33B76' },
      themeStyle: { type: String, default: 'pastel-light' },
      fontFamily: { type: String, default: 'Plus Jakarta Sans' },
      displayMode: { type: String, default: 'light' },
      backgroundVideoUrl: { type: String, default: '' }
    },
    registrationProtocolConfig: {
      attendeeLabel: { type: String, default: 'Attendee' },
      attendeeSubtitle: { type: String, default: 'General Entry Access' },
      startupLabel: { type: String, default: 'Founder' },
      startupSubtitle: { type: String, default: 'Pitching & Stall Access' }
    },
    isPublic: { type: Boolean, default: false } // Only paid or superadmin events are public
  },
  { timestamps: true, strict: false }
);

const accessLogSchema = new mongoose.Schema(
  {
    plateNumber: { type: String, required: true },
    location: { type: String, default: "Main Entrance" },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const waitlistSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

const contactSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    role: String,
    message: String,
  },
  { timestamps: true }
);

const parkingSchema = new mongoose.Schema(
  {
    ID: { type: String, default: null },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Owner",
      default: null,
    },
    Location: { type: String, required: true },
    Latitude: { type: Number, required: true },
    Longitude: { type: Number, required: true },
    PricePerHour: { type: Number, default: null },
    TotalSlots: { type: Number, default: null, min: 0 },
    Type: { type: String, default: "Public Parking" },
    Authority: { type: String, default: "Public" },
    Zone: { type: String, default: null },
    Status: { type: String, default: "Active" },
  },
  { timestamps: true }
);

const bookingSchema = new mongoose.Schema(
  {
    parkingId: {
      type: String, // Allow both ObjectId and numeric IDs from seeded data
      default: null,
    },
    eventId: { type: String, default: null },
    transactionId: { type: String, default: null },
    ownerId: {
      type: String, // Allow both ObjectId and null/numeric IDs
      default: null,
    },
    userId: {
      type: String,
      default: null,
    },
    locationName: String,
    vehicleType: String,
    vehicleNumber: String,
    ticketId: { type: String, sparse: true }, // Unique ID for QR code
    attended: { type: Boolean, default: false }, // Check-in status
    attendedAt: { type: Date, default: null },
    scannedBy: { type: String, default: null },
    startTime: String,
    endTime: String,
    amount: String,
    email: { type: String, default: null },
    phone: { type: String, default: null },
    name: { type: String, default: null },
    emailSent: { type: Boolean, default: false },
    screenshotUrl: { type: String, default: null },
    status: { type: String, default: "Confirmed" },
    tierName: { type: String, default: null },
    customData: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    date: { type: Date, default: Date.now },
    // Platform Monetization Fields
    platformFee: { type: Number, default: 0 }, // 5-8% commission
    organizerPayout: { type: Number, default: 0 }, // Amount after fee
  },
  { timestamps: true }
);

bookingSchema.index({ eventId: 1 });
bookingSchema.index({ transactionId: 1 });
bookingSchema.index({ status: 1 });

const eventRequestSchema = new mongoose.Schema(
  {
    eventName: { type: String, required: true },
    contactName: { type: String, required: true },
    contactEmail: { type: String, required: true },
    description: String,
    status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
  },
  { timestamps: true }
);

const systemLogSchema = new mongoose.Schema(
  {
    source: { type: String, required: true }, // 'admin', 'events', 'web'
    type: { type: String, default: 'frontend_crash' }, // 'frontend_crash', 'api_failure', 'payment_failure'
    message: String,
    stack: String,
    url: String,
    resolved: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

const commentSchema = new mongoose.Schema(
  {
    discussionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discussion",
      required: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    text: { type: String, required: true, maxlength: 2000 },
    authorName: { type: String, required: true },
    authorPhoto: { type: String, default: "" },
    authorUid: { type: String, required: true },
    upvotes: { type: [String], default: [] },
    downvotes: { type: [String], default: [] },
  },
  { timestamps: true }
);

const discussionSchema = new mongoose.Schema(
  {
    eventTitle: { type: String, required: true },
    eventId: { type: String },
    eventImage: { type: String, default: "" },
    review: { type: String, required: true, maxlength: 5000 },
    rating: { type: Number, min: 1, max: 5, required: true },
    authorName: { type: String, required: true },
    authorPhoto: { type: String, default: "" },
    authorUid: { type: String, required: true },
    upvotes: { type: [String], default: [] },
    downvotes: { type: [String], default: [] },
    commentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const verificationCodeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
export const VerificationCode = mongoose.models.VerificationCode || mongoose.model("VerificationCode", verificationCodeSchema);
export const Owner = mongoose.models.Owner || mongoose.model("Owner", ownerSchema);
export const Event = mongoose.models.Event || mongoose.model("Event", eventSchema);
export const AccessLog = mongoose.models.AccessLog || mongoose.model("AccessLog", accessLogSchema);
export const Waitlist = mongoose.models.Waitlist || mongoose.model("Waitlist", waitlistSchema);
export const Contact = mongoose.models.Contact || mongoose.model("Contact", contactSchema);
export const Comment = mongoose.models.Comment || mongoose.model("Comment", commentSchema);
export const Discussion = mongoose.models.Discussion || mongoose.model("Discussion", discussionSchema);
export const Parking = mongoose.models.Parking || mongoose.model("Parking", parkingSchema);
export const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
export const EventRequest = mongoose.models.EventRequest || mongoose.model("EventRequest", eventRequestSchema);
export const SystemLog = mongoose.models.SystemLog || mongoose.model("SystemLog", systemLogSchema);

export const getSecondaryModel = (modelName) => {
    // This safely creates or retrieves a secondary connection to park_conscious
    // without hijacking the global connection.
    const db = mongoose.connection.useDb('park_conscious', { useCache: true });
    if (db.models[modelName]) return db.models[modelName];

    // Map model names to schemas
    const schemas = {
        'User': userSchema,
        'Owner': ownerSchema,
        'Parking': parkingSchema,
        'Booking': bookingSchema
    };

    if (!schemas[modelName]) {
        throw new Error(`Schema for ${modelName} not defined in secondary models map.`);
    }

    return db.model(modelName, schemas[modelName]);
};

/**
 * apps/admin/src/services/api.js
 *
 * Purpose: Centralised Axios instance and service layer for the Admin Panel.
 * Attaches JWT tokens to outgoing requests and redirects to /login on 401.
 * Exports grouped service objects: authService, eventService, bookingService,
 * userService, and adminService.
 */
import axios from 'axios';

// Force relative paths in production to bypass CORS and preflight redirect issues
const API_URL = (import.meta.env.VITE_API_URL || "").replace('https://events.parkconscious.in', '');
console.log('%c[ADMIN_NEXUS] Primary Logic Link:', 'color: #0ea5e9; font-weight: bold;', API_URL);
console.log('%c[BUILD_VERSION] v2.0.9-DIAGNOSTIC-FIX', 'color: #10b981; font-weight: bold;');

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add the JWT token to headers
api.interceptors.request.use(
  (config) => {
    try {
      const adminSession = localStorage.getItem('adminUser');
      if (adminSession) {
        const { token } = JSON.parse(adminSession);
        if (token) config.headers.Authorization = `Bearer ${token}`;
      }
    } catch(e) {
      console.error('[AXIOS INTERCEPTOR ERROR]:', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle expired sessions
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('[AXIOS INTERCEPTOR] Session Expired. Clearing cache and redirecting to login.');
      localStorage.removeItem('adminUser');
      // If we're not already on the login page, redirect
      if (window.location.pathname !== '/login') {
         window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: (username, password) => api.post('/api/auth/login', { email: username, password }), // Backend uses email
};

export const eventService = {
  getAll: () => api.get('/api/events/admin/all'),
  getPublic: () => api.get('/api/events'),
  getById: (id) => api.get(`/api/events/${id}`),
  create: (eventData) => api.post('/api/events', eventData),
  update: (id, eventData) => api.put(`/api/events/${id}`, eventData),
  delete: (id) => api.delete(`/api/events/${id}`),
  // Deprecated: Moving to direct frontend upload to bypass serverless limits
  // uploadImage: (formData) => api.post('/api/events/upload', formData, {
  //   headers: { 'Content-Type': 'multipart/form-data' }
  // }),
};

export const bookingService = {
  getAllAttendees: () => api.get('/api/admin/bookings/all'),
  getAllParkingBookings: () => api.get('/api/admin/bookings/all?context=parking'),
  checkIn: (ticketId) => api.post('/api/bookings/check-in', { ticketId }),
  unCheckIn: (ticketId) => api.post('/api/bookings/un-check-in', { ticketId }),
  deleteBooking: (id) => api.delete(`/api/admin/bookings/${id}`),
  reconcilePayments: () => api.post('/api/admin/reconcile'),
  broadcastEmails: (bookingIds) => api.post('/api/admin/email-batch', { bookingIds })
};

export const userService = {
  getAll: () => api.get('/api/admin/users'),
  create: (userData) => api.post('/api/admin/users', userData),
  delete: (id) => api.delete(`/api/admin/users/${id}`),
};

export const adminService = {
  getLogs: () => api.get('/api/admin/logs'),
  resolveLog: (id, resolved) => api.patch(`/api/admin/logs/${id}`, { resolved }),
  getStats: () => api.get('/api/admin/stats'),
  getInsights: () => api.get('/api/admin/organizer/insights'),
  getInquiries: () => api.get('/api/admin/inquiries'),
  handleInquiry: (action, id, data) => {
    if (action === 'delete') return api.delete(`/api/admin/inquiries/contact/${id}`);
    if (action === 'patch' || action === 'update') return api.patch(`/api/admin/inquiries/request/${id}`, data);
    throw new Error(`Invalid inquiry action: ${action}`);
  }
};

export default api;

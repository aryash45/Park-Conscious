/**
 * apps/admin/src/components/EventForm.jsx
 *
 * Purpose: Centralized, reusable form component for creating and editing events.
 * Handles complex state management for all event properties including
 * dynamic ticket tiers, custom data collection fields, hosts, featured UI settings,
 * and Cloudinary media uploads.
 */
import React, { useState, useEffect } from 'react';
import { 
  Upload, X, MapPin, Calendar, Tag, Shield, 
  Info, IndianRupee, Users, PlusCircle, 
  ChevronDown, ChevronUp, Star, AlertCircle,
  Lock, Layout, Monitor, Globe, Trash2, RefreshCw, Ticket, Palette, PlayCircle, Rocket, ShieldCheck, Zap, Link2, FileInput, CheckCircle2
} from 'lucide-react';
import { uploadToCloudinary, uploadVideoToCloudinary } from '../utils/cloudinary';
import axios from 'axios';
import { normalizeApiUrl } from '../utils/apiUtils';
import { eventService } from '../services/api';

const SessionIdDisplay = () => {
  const [sessionId] = useState(() => Math.random().toString(36).substring(7).toUpperCase());
  return (
    <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest mt-1">
      Session ID: {sessionId}
    </p>
  );
};

const safeParseAdminUser = () => {
  try {
    const raw = localStorage.getItem('adminUser');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};


const EventForm = ({ initialData = null, onSubmit, loading, onThemeChange }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    endDate: '',
    locationName: '',
    locationAddress: '',
    lat: '',
    lng: '',
    category: '',
    price: 0,
    capacity: 0,
    status: 'published',
    images: [],
    isFeatured: false,
    featuredTitle: '',
    featuredSubtitle: '',
    featuredLabel: '',
    accentColor: 'indigo-500',
    requiredFields: {
      name: true,
      email: true,
      phone: true
    },
    mediaGallery: [],
    customForms: [],
    hosts: [],
    ticketTiers: [],
    startupFormEnabled: false,
    themeConfig: {
      primaryColor: '#E33B76',
      themeStyle: 'pastel-light',
      fontFamily: 'Plus Jakarta Sans',
      displayMode: 'light',
      backgroundVideoUrl: ''
    },

    isPublic: false,
    listingPaid: false,
    isTBA: false,
    isOnline: false,
    registrationProtocolConfig: {
      attendeeLabel: 'Attendee',
      attendeeSubtitle: 'General Entry Access',
      startupLabel: 'Founder',
      startupSubtitle: 'Pitching & Stall Access'
    }
  });

  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    if (onThemeChange && formData.themeConfig) {
      onThemeChange(formData.themeConfig);
    }
  }, [formData.themeConfig, onThemeChange]);

  const [showAdvancedLocation, setShowAdvancedLocation] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const [error, setError] = useState('');

  // Google Form Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importMode, setImportMode] = useState('append'); // 'append' | 'overwrite'
  const [importSuccess, setImportSuccess] = useState(null); // { count, title }

  const handleGoogleFormImport = async () => {
    if (!importUrl.trim()) {
      setImportError('Please paste a Google Form URL.');
      return;
    }
    setIsImporting(true);
    setImportError('');
    setImportSuccess(null);
    try {
      const { data } = await eventService.importGoogleForm(importUrl.trim());
      const newFields = (data.customForms || []).map(f => ({ ...f, id: f.id || `gf_${Date.now()}_${Math.random().toString(36).slice(2)}` }));
      setFormData(prev => ({
        ...prev,
        customForms: importMode === 'overwrite'
          ? newFields
          : [...(Array.isArray(prev.customForms) ? prev.customForms : []), ...newFields]
      }));
      setImportSuccess({ count: newFields.length, title: data.title });
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportUrl('');
        setImportSuccess(null);
        setImportMode('append');
      }, 1800);
    } catch (err) {
      setImportError(err.response?.data?.error || err.message || 'Import failed. Check the URL and try again.');
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    if (initialData) {
      Promise.resolve().then(() => {
        setFormData(prevData => ({
          ...prevData,
          ...initialData,
          date: initialData.date ? initialData.date.split('T')[0] : '',
          endDate: initialData.endDate ? initialData.endDate.split('T')[0] : '',
          locationName: initialData.location?.name || '',
          locationAddress: initialData.location?.address || '',
          lat: initialData.location?.coordinates?.lat || '',
          lng: initialData.location?.coordinates?.lng || '',
          customForms: initialData.customForms || [],
          mediaGallery: initialData.mediaGallery || [],
          category: initialData.category || '',
          isFeatured: initialData.isFeatured || false,
          featuredTitle: initialData.featuredTitle || '',
          featuredSubtitle: initialData.featuredSubtitle || '',
          featuredLabel: initialData.featuredLabel || '',
          accentColor: initialData.accentColor || 'indigo-500',
          price: initialData.price ?? initialData.regularPrice ?? 0,
          capacity: initialData.capacity ?? 0,
          requiredFields: {
            name:  initialData.requiredFields?.name  ?? true,
            email: initialData.requiredFields?.email ?? true,
            phone: initialData.requiredFields?.phone ?? true,
          },
          hosts: initialData.hosts || [],
          ticketTiers: initialData.ticketTiers || [],
          startupFormEnabled: initialData.startupFormEnabled || false,
            themeConfig: initialData.themeConfig || {
              primaryColor: '#E33B76',
              themeStyle: 'pastel-light',
              fontFamily: 'Plus Jakarta Sans',
              displayMode: 'light',
              backgroundVideoUrl: ''
            },
            registrationProtocolConfig: initialData.registrationProtocolConfig || {
              attendeeLabel: 'Attendee',
              attendeeSubtitle: 'General Entry Access',
              startupLabel: 'Founder',
              startupSubtitle: 'Pitching & Stall Access'
            },
            isTBA: initialData.isTBA || false,
            isOnline: initialData.isOnline || false
          }));
        if (initialData.location?.coordinates?.lat || initialData.location?.coordinates?.lng) {
          setShowAdvancedLocation(true);
        }
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const newVal = type === 'checkbox' ? checked : value;
      let nextData = { ...prev, [name]: newVal };

      // If turning off Startup Registration, automatically prune the st_ fields
      if (name === 'startupFormEnabled' && !newVal) {
        nextData.customForms = (Array.isArray(prev.customForms) ? prev.customForms : [])
          .filter(f => f && typeof f === 'object' && typeof f.id === 'string' && !f.id.startsWith('st_'));
      }

      return nextData;
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const secureUrl = await uploadToCloudinary(file);
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, secureUrl]
      }));
    } catch (err) {
        console.error('Upload Error:', err);
        setError(`MEDIA TRANSMISSION FAILURE: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const [copied, setCopied] = useState(false);
  const handleCopyLink = () => {
    if (!initialData?._id) return;
    const EVENTS_BASE = import.meta.env.VITE_EVENTS_APP_URL || "https://events.parkconscious.in";
    const url = `${EVENTS_BASE}/event/${initialData._id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePromotePayment = async () => {
    let API_BASE = normalizeApiUrl(import.meta.env.VITE_API_URL);
    
    if (!initialData?._id) {
      console.warn("[PAYMENT_ERROR] No Event ID found in initialData");
      alert("Please save the event details first before promoting to the homepage.");
      return;
    }

    setLocalLoading(true);
    try {
      // 1. Create Order
      const { data: orderData } = await axios.post(`${API_BASE}/api/events/promote/order`, {
        eventId: initialData._id
      }, { withCredentials: true });


      if (!orderData.success) throw new Error(orderData.message);

      // 2. Open Razorpay
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: "INR",
        name: "Backstage Promotion",
        description: `Promote "${formData.title}" to Homepage`,
        order_id: orderData.orderId,
        handler: async (response) => {
          try {
            const { data: verifyData } = await axios.post(`${API_BASE}/api/events/promote/verify`, {
              ...response,
              eventId: initialData._id
            }, { withCredentials: true });

            if (verifyData.success) {
              setFormData(prev => ({ ...prev, listingPaid: true, isPublic: true }));
              alert("Payment Successful! Your event is now promoted to the homepage.");
            }
          } catch (err) {
            console.error("[PAYMENT_VERIFY_ERROR]", err);
            alert("Verification Failed: " + (err.response?.data?.message || err.message));
          }
        },
        prefill: {
          email: safeParseAdminUser()?.email || "",
          contact: safeParseAdminUser()?.phone || ""
        },
        theme: { color: "#6366f1" }
      };

      if (!window.Razorpay) {
        throw new Error("Razorpay SDK not loaded. Please refresh the page.");
      }

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("[PAYMENT_FATAL_ERROR]", err);
      alert("Payment Initialization Failed: " + (err.response?.data?.message || err.message));
    } finally {
      setLocalLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submissionData = {
        ...formData,
        price: parseInt(formData.price) || 0,
        capacity: parseInt(formData.capacity) || 0,
        location: {
            name: formData.locationName,
            address: formData.locationAddress,
            coordinates: {
                lat: parseFloat(formData.lat) || 0,
                lng: parseFloat(formData.lng) || 0
            }
        },
        requiredFields: formData.requiredFields,
        mediaGallery: formData.mediaGallery || [],
        hosts: formData.hosts || [],
        ticketTiers: formData.ticketTiers || [],
        startupFormEnabled: formData.startupFormEnabled || false,
        themeConfig: formData.themeConfig,
        isPublic: formData.isPublic,
        listingPaid: formData.listingPaid,
        isTBA: formData.isTBA,
        isOnline: formData.isOnline,
        registrationProtocolConfig: formData.registrationProtocolConfig
    };
    onSubmit(submissionData);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-6 py-4 rounded-3xl text-[10px] font-black uppercase tracking-widest flex items-center gap-4 shadow-2xl shadow-rose-950/10">
           <AlertCircle size={20} /> 
           <span>{error}</span>
           <span className="ml-auto opacity-50">Image bypass available</span>
        </div>
      )}

      <div className="space-y-12">
        {/* Identity Section */}
        <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 space-y-8 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
              <Layout className="text-sky-500" size={20} /> EVENT DETAILS
            </h3>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest bg-slate-950 px-3 py-1 rounded-full border border-slate-800">Section 01</span>
            </div>
            
            <div className="space-y-8">
              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Asset Title</label>
                <input 
                  type="text" name="title" required value={formData.title} onChange={handleChange}
                  placeholder="Theatrical Performance, Tech Symposium, etc."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm focus:outline-none focus:border-sky-500/50 transition-all shadow-inner placeholder:text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Experience Narrative</label>
                <textarea 
                  name="description" rows="6" value={formData.description} onChange={handleChange}
                  placeholder="Define the vision and specific details of this encounter..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm focus:outline-none focus:border-sky-500/50 transition-all shadow-inner resize-none font-medium placeholder:text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Category</label>
                <select
                  name="category" value={formData.category} onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm focus:outline-none focus:border-sky-500/50 transition-all font-medium appearance-none"
                >
                  <option value="">Select a category...</option>
                  {['Music', 'Arts', 'Tech', 'Sports', 'Comedy', 'Culture', 'Summits', 'Food', 'Fashion', 'Film', 'Education', 'Gaming', 'Wellness', 'Other'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar size={18} className="text-sky-500" />
                  <div>
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Date & Time Protocol</p>
                    <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">Is this event date finalized?</p>
                  </div>
                </div>
                <label className="flex items-center gap-4 cursor-pointer">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Date TBA</span>
                  <div className="relative">
                    <input 
                      type="checkbox" name="isTBA" checked={formData.isTBA} onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-800 rounded-full peer-checked:bg-sky-500 transition-all relative">
                      <div className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-all peer-checked:translate-x-5" style={{transform: formData.isTBA ? 'translateX(20px)' : 'translateX(0)'}} />
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </section>

          {/* Date Section (Optional based on isTBA) */}
          {!formData.isTBA && (
            <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 space-y-8 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
               <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                  <Calendar className="text-sky-500" size={20} /> TEMPORAL COORDINATES
                </h3>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest bg-slate-950 px-3 py-1 rounded-full border border-slate-800">Date Info</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Event Date</label>
                  <input 
                    type="date" name="date" required={!formData.isTBA} value={formData.date} onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm focus:outline-none focus:border-sky-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Start Time</label>
                  <input 
                    type="time" name="startTime" value={formData.startTime} onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm focus:outline-none focus:border-sky-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">End Time</label>
                  <input 
                    type="time" name="endTime" value={formData.endTime} onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>
            </section>
          )}
          
          {/* Hosts Section */}
          <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 space-y-8 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                <Users className="text-[#6366f1]" size={20} /> EVENT ORGANIZERS
              </h3>
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  hosts: [...(prev.hosts || []), { name: '', role: 'Host', image: '', socialLink: '' }]
                }))}
                className="flex items-center gap-2 bg-[#6366f1]/10 hover:bg-[#6366f1]/20 text-[#6366f1] px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border border-[#6366f1]/20"
              >
                <PlusCircle size={14} /> Add Host
              </button>
            </div>

            <div className="space-y-6">
              {formData.hosts.map((host, idx) => (
                <div key={idx} className="p-6 bg-slate-950 border border-slate-800 rounded-3xl space-y-6 relative group">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      hosts: prev.hosts.filter((_, i) => i !== idx)
                    }))}
                    className="absolute top-4 right-4 text-slate-600 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    <div className="md:col-span-3">
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Photo</label>
                      <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center group/img">
                        {host.image ? (
                          <img src={host.image} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <Users size={24} className="text-slate-800" />
                        )}
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                          <input
                            type="file" className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                                try {
                                  const url = await uploadToCloudinary(file);
                                  setFormData(prev => ({
                                    ...prev,
                                    hosts: prev.hosts.map((h, i) => i === idx ? { ...h, image: url } : h)
                                  }));
                                } catch (err) { console.error(err); }
                            }}
                          />
                          <Upload size={18} className="text-white" />
                        </label>
                      </div>
                    </div>

                    <div className="md:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">Name</label>
                        <input
                          type="text" value={host.name}
                          onChange={(e) => {
                            setFormData(prev => ({
                              ...prev,
                              hosts: prev.hosts.map((h, i) => i === idx ? { ...h, name: e.target.value } : h)
                            }));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-[#6366f1]/50"
                          placeholder="Host Name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">Role</label>
                        <input
                          type="text" value={host.role}
                          onChange={(e) => {
                            setFormData(prev => ({
                              ...prev,
                              hosts: prev.hosts.map((h, i) => i === idx ? { ...h, role: e.target.value } : h)
                            }));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-[#6366f1]/50"
                          placeholder="e.g. Moderator, Organizer"
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-2">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">Social / Profile Link</label>
                        <input
                          type="text" value={host.socialLink}
                          onChange={(e) => {
                            setFormData(prev => ({
                              ...prev,
                              hosts: prev.hosts.map((h, i) => i === idx ? { ...h, socialLink: e.target.value } : h)
                            }));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-[#6366f1]/50"
                          placeholder="https://instagram.com/..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {formData.hosts.length === 0 && (
                <div className="text-center p-12 border border-dashed border-slate-800 rounded-3xl bg-slate-950/30">
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">No hosts defined. The organizer will be the default host.</p>
                </div>
              )}
            </div>
          </section>


          {/* Venue Section */}
          <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 space-y-8 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                <MapPin className="text-sky-500" size={20} /> DEPOT LOCATION
              </h3>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest bg-slate-950 px-3 py-1 rounded-full border border-slate-800">Section 02</span>
            </div>
            
            <div className="space-y-8">
              <label className="flex items-center justify-between p-6 bg-slate-950 border border-slate-800 rounded-3xl cursor-pointer hover:border-sky-500/40 transition-all group">
                <div className="flex items-center gap-4">
                  <Monitor size={20} className="text-sky-500" />
                  <div>
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Online Experience</p>
                    <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">This event takes place in the digital realm</p>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="checkbox" name="isOnline" checked={formData.isOnline} onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-800 rounded-full peer-checked:bg-sky-500 transition-all relative">
                    <div className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-all peer-checked:translate-x-5" style={{transform: formData.isOnline ? 'translateX(20px)' : 'translateX(0)'}} />
                  </div>
                </div>
              </label>

              {!formData.isOnline && (
                <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Venue Primary Identity</label>
                    <input 
                      type="text" name="locationName" required={!formData.isOnline} value={formData.locationName} onChange={handleChange}
                      placeholder="Global Convention Centre"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm focus:outline-none focus:border-sky-500/50 transition-all font-medium"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Physical Coordinates</label>
                    <input 
                      type="text" name="locationAddress" value={formData.locationAddress} onChange={handleChange}
                      placeholder="Block 4, Industrial Area, Noida, UP"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm focus:outline-none focus:border-sky-500/50 transition-all font-medium"
                    />
                  </div>

                  <div className="pt-2">
                    <button 
                      type="button" 
                      onClick={() => setShowAdvancedLocation(!showAdvancedLocation)}
                      className="flex items-center gap-3 text-[10px] font-black text-slate-600 hover:text-sky-500 uppercase tracking-[0.2em] transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center group-hover:border-sky-500/50">
                        {showAdvancedLocation ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                      Geospatial Telemetry
                    </button>
                  </div>

                  {showAdvancedLocation && (
                    <div className="grid grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-sky-500/60 uppercase tracking-[0.2em] ml-1">Latitude</label>
                        <input 
                          type="number" step="any" name="lat" value={formData.lat} onChange={handleChange}
                          placeholder="0.00000"
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-xs font-mono focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-sky-500/60 uppercase tracking-[0.2em] ml-1">Longitude</label>
                        <input 
                          type="number" step="any" name="lng" value={formData.lng} onChange={handleChange}
                          placeholder="0.00000"
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-xs font-mono focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {formData.isOnline && (
                 <div className="p-8 bg-slate-950 border border-slate-800 rounded-3xl animate-in fade-in zoom-in duration-500 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-500 mx-auto">
                      <Globe size={32} className="animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-white uppercase tracking-widest">Digital Realm Activated</p>
                      <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-1">This event will be hosted via a virtual platform link provided later.</p>
                    </div>
                 </div>
              )}
            </div>
          </section>

          {/* Visibility & Distribution Section */}
          <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 space-y-8 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Globe size={120} className="text-sky-500" />
             </div>
             
             <div className="flex items-center justify-between relative z-10">
              <h3 className="text-[12px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                <Globe className="text-sky-500" size={20} /> VISIBILITY & DISTRIBUTION
              </h3>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest bg-slate-950 px-3 py-1 rounded-full border border-slate-800">Section 03</span>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="p-6 bg-slate-950 border border-slate-800 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black text-white uppercase tracking-widest">Publicity Protocol</p>
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-1">Control how this asset is discovered</p>
                  </div>
                  
                  {/* SuperAdmin or Paid User can toggle */}
                  {(safeParseAdminUser()?.role === 'superadmin' || formData.listingPaid) ? (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" name="isPublic" checked={formData.isPublic} onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                    </label>
                  ) : (
                    <button 
                      type="button"
                      onClick={handlePromotePayment}
                      disabled={localLoading}
                      className="flex items-center gap-2 px-6 py-3 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {localLoading ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <IndianRupee size={14} />
                      )}
                      {localLoading ? 'Processing...' : 'Promote to Homepage (₹499)'}
                    </button>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-900 grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className={`p-4 rounded-2xl border transition-all ${formData.isPublic ? 'bg-sky-500/5 border-sky-500/20' : 'bg-slate-900 border-slate-800'}`}>
                      <div className="flex items-center gap-3 mb-2">
                        <Globe size={14} className={formData.isPublic ? 'text-sky-500' : 'text-slate-600'} />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Homepage Listing</span>
                      </div>
                      <p className="text-[9px] font-medium text-slate-500 leading-relaxed uppercase">
                        {formData.isPublic 
                          ? "This event is currently live on the Backstage homepage and search results." 
                          : "This event is currently unlisted. It will NOT appear on the home page."}
                      </p>
                   </div>
                   <div className="p-4 rounded-2xl border bg-emerald-500/5 border-emerald-500/20 group/link relative">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Link2 size={14} className="text-emerald-500" />
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">Direct Link Access</span>
                        </div>
                        {initialData?._id && (
                          <button
                            type="button"
                            onClick={handleCopyLink}
                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-white/5 text-emerald-500 hover:bg-white/10 border border-emerald-500/20'}`}
                          >
                            {copied ? 'Copied!' : 'Copy Link'}
                          </button>
                        )}
                      </div>
                      <p className="text-[9px] font-medium text-slate-500 leading-relaxed uppercase">
                        Always active. You can share this event via link like a private Google Form even if unlisted.
                      </p>
                   </div>
                </div>
              </div>
            </div>
          </section>



          {/* Protocols Section */}
          <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 space-y-8 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                <Lock className="text-sky-500" size={20} /> REGISTRATION DETAILS
              </h3>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest bg-slate-950 px-3 py-1 rounded-full border border-slate-800">Section 04</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {['name', 'email', 'phone'].map(field => (
                <label key={field} className="flex flex-col gap-4 p-6 bg-slate-950 border border-slate-800 rounded-3xl cursor-pointer hover:border-sky-500/50 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                    <Users size={64} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 group-hover:text-white uppercase tracking-[0.2em] mt-0.5">Collect {field}</span>
                    <div className="relative">
                      <input 
                        type="checkbox"
                        checked={formData.requiredFields[field]}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          requiredFields: { ...prev.requiredFields, [field]: e.target.checked }
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-6 h-6 border-2 border-slate-800 rounded-lg peer-checked:bg-sky-500 peer-checked:border-sky-500 transition-all flex items-center justify-center">
                        <svg className="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Startup Registration Toggle */}
            <div className="pt-8 border-t border-slate-800">
               <label className="flex items-center justify-between p-6 bg-slate-950 border border-slate-800 rounded-3xl cursor-pointer hover:border-emerald-500/40 transition-all group shadow-inner">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                     <Star size={24} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-white uppercase tracking-widest">Enable Dual-Track Registration</p>
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-1">Only activate if you need users to choose between two paths (e.g. Attendee vs Founder). Leave OFF for a single form.</p>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="checkbox" name="startupFormEnabled"
                    checked={formData.startupFormEnabled}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-800 rounded-full peer-checked:bg-emerald-500 transition-all relative">
                    <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-6" style={{transform: formData.startupFormEnabled ? 'translateX(24px)' : 'translateX(0)'}} />
                  </div>
                </div>
              </label>

              {formData.startupFormEnabled && (
                <div className="mt-8 p-8 bg-slate-950/50 border border-slate-800 rounded-3xl space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="text-emerald-500" size={18} />
                    <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Dual-Track Customization</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Attendee Protocol Config */}
                    <div className="space-y-6 p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                      <p className="text-[9px] font-black text-sky-500 uppercase tracking-widest">Protocol A (Standard)</p>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Main Label</label>
                          <input 
                            type="text" 
                            value={formData.registrationProtocolConfig?.attendeeLabel}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              registrationProtocolConfig: { ...(prev.registrationProtocolConfig || {}), attendeeLabel: e.target.value }
                            }))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-sky-500/50 transition-all"
                            placeholder="e.g. Attendee, Participant"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Subtitle / Description</label>
                          <input 
                            type="text" 
                            value={formData.registrationProtocolConfig?.attendeeSubtitle}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              registrationProtocolConfig: { ...(prev.registrationProtocolConfig || {}), attendeeSubtitle: e.target.value }
                            }))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-sky-500/50 transition-all"
                            placeholder="e.g. General Entry Access"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Startup Protocol Config */}
                    <div className="space-y-6 p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                      <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Protocol B (Premium/Custom)</p>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Main Label</label>
                          <input 
                            type="text" 
                            value={formData.registrationProtocolConfig?.startupLabel}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              registrationProtocolConfig: { ...(prev.registrationProtocolConfig || {}), startupLabel: e.target.value }
                            }))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-emerald-500/50 transition-all"
                            placeholder="e.g. Founder, VIP, Speaker"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Subtitle / Description</label>
                          <input 
                            type="text" 
                            value={formData.registrationProtocolConfig?.startupSubtitle}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              registrationProtocolConfig: { ...(prev.registrationProtocolConfig || {}), startupSubtitle: e.target.value }
                            }))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-emerald-500/50 transition-all"
                            placeholder="e.g. Pitching & Stall Access"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-8 border-t border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                    <PlusCircle className="text-sky-500" size={16} /> Dynamic Data Collection
                  </h4>
                  <p className="text-[9px] font-medium text-slate-500 uppercase tracking-widest mt-1">Add custom inputs for checkout</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const startupFields = [
                        { id: 'st_stall', label: 'Do you want a stall?', type: 'select', options: ['Yes', 'No'], required: true },
                        { id: 'st_name', label: 'Startup Name', type: 'text', required: true },
                        { id: 'st_link', label: 'Website / LinkedIn Page', type: 'text', required: true },
                        { id: 'st_sector', label: 'Startup Sector / Industry', type: 'select', options: ['FinTech', 'HealthTech', 'EdTech', 'AgriTech', 'SaaS', 'AI / ML', 'E-commerce', 'Climate / CleanTech', 'Other'], required: true },
                        { id: 'st_stage', label: 'Startup Stage', type: 'select', options: ['Idea Stage', 'MVP Stage', 'Early Revenue', 'Growth Stage', 'Other'], required: true },
                        { id: 'st_desc', label: 'Brief Startup Description', type: 'textarea', required: true },
                        { id: 'st_deck', label: 'Pitch Deck (PDF/PPT)', type: 'file', required: true },
                        { id: 'st_prob', label: 'Problem You Are Solving', type: 'textarea', required: true },
                        { id: 'st_sol', label: 'Solution / Product Overview', type: 'textarea', required: true },
                        { id: 'st_market', label: 'Target Customers / Market', type: 'textarea', required: true },
                        { id: 'st_confirm', label: 'I confirm all information is accurate', type: 'checkbox', required: true },
                      ];
                      setFormData(prev => ({
                        ...prev,
                        startupFormEnabled: true,
                        customForms: [
                          ...(Array.isArray(prev.customForms) ? prev.customForms : []), 
                          ...startupFields.filter(sf => !(Array.isArray(prev.customForms) ? prev.customForms : []).some(cf => cf && typeof cf === 'object' && cf.id === sf.id))
                        ]
                      }));
                    }}
                    className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border border-emerald-500/20"
                  >
                    <RefreshCw size={12} /> Load Dual-Track Startup Template
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsImportModalOpen(true); setImportError(''); setImportSuccess(null); setImportUrl(''); }}
                    className="flex items-center gap-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border border-violet-500/20"
                  >
                    <FileInput size={13} /> Import Google Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      customForms: [...(Array.isArray(prev.customForms) ? prev.customForms : []), { id: Date.now().toString(), label: '', type: 'text', required: false, options: [] }]
                    }))}
                    className="flex items-center gap-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border border-sky-500/20"
                  >
                    <PlusCircle size={14} /> Add Field
                  </button>
                </div>

              {/* ── Google Form Import Modal ── */}
              {isImportModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
                  <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl shadow-violet-950/40 animate-in zoom-in-95 duration-300">
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shadow-lg shadow-violet-900/20">
                          <FileInput size={20} className="text-violet-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-white uppercase tracking-tight">Import from Google Form</h3>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-0.5">Auto-import questions &amp; field types</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setIsImportModalOpen(false); setImportError(''); setImportSuccess(null); }}
                        className="p-2 text-slate-500 hover:text-white transition-colors rounded-xl hover:bg-slate-800"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Body */}
                    <div className="p-8 space-y-6">
                      {/* URL Input */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Google Form URL</label>
                        <input
                          type="url"
                          value={importUrl}
                          onChange={(e) => { setImportUrl(e.target.value); setImportError(''); }}
                          placeholder="https://docs.google.com/forms/d/e/.../viewform"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500/50 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-slate-700 focus:outline-none transition-all font-medium"
                        />
                        <p className="text-[9px] text-slate-600 font-medium ml-1">Paste any public Google Form share or view link.</p>
                      </div>

                      {/* Import Mode Toggle */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Import Mode</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setImportMode('append')}
                            className={`flex flex-col items-start gap-1.5 p-4 rounded-2xl border-2 transition-all ${
                              importMode === 'append'
                                ? 'bg-violet-500/10 border-violet-500/50 text-violet-300'
                                : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                            }`}
                          >
                            <PlusCircle size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Append</span>
                            <span className="text-[9px] font-medium opacity-70">Add below existing fields</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setImportMode('overwrite')}
                            className={`flex flex-col items-start gap-1.5 p-4 rounded-2xl border-2 transition-all ${
                              importMode === 'overwrite'
                                ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                                : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                            }`}
                          >
                            <RefreshCw size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Overwrite</span>
                            <span className="text-[9px] font-medium opacity-70">Replace all existing fields</span>
                          </button>
                        </div>
                      </div>

                      {/* Error */}
                      {importError && (
                        <div className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                          <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                          <p className="text-[10px] font-bold text-rose-400 leading-relaxed">{importError}</p>
                        </div>
                      )}

                      {/* Success */}
                      {importSuccess && (
                        <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                          <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{importSuccess.count} Fields Imported!</p>
                            {importSuccess.title && <p className="text-[9px] text-emerald-600 font-medium mt-0.5 truncate">From: {importSuccess.title}</p>}
                          </div>
                        </div>
                      )}

                      {/* Supported types note */}
                      {!importError && !importSuccess && (
                        <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Supported Field Types</p>
                          <div className="flex flex-wrap gap-2">
                            {['Short Text', 'Paragraph', 'Dropdown', 'Multiple Choice', 'Checkboxes', 'File Upload'].map(t => (
                              <span key={t} className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[9px] font-bold text-slate-500 uppercase tracking-widest">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => { setIsImportModalOpen(false); setImportError(''); setImportSuccess(null); }}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-black text-[9px] uppercase tracking-[0.2em] py-4 rounded-2xl transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleGoogleFormImport}
                          disabled={isImporting || !importUrl.trim()}
                          className="flex-[2] bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-black text-[9px] uppercase tracking-[0.2em] py-4 rounded-2xl transition-all shadow-xl shadow-violet-950/40 flex items-center justify-center gap-2"
                        >
                          {isImporting ? (
                            <><RefreshCw size={14} className="animate-spin" /> Importing&hellip;</>
                          ) : (
                            <><FileInput size={14} /> Import Fields</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </div>

              {formData.customForms && formData.customForms.length > 0 ? (
                <div className="space-y-4">
                  {formData.customForms.map((field, index) => (
                    <div key={field.id} className="flex flex-col gap-4 p-6 bg-slate-950 border border-slate-800 rounded-3xl group animate-in slide-in-from-left-2">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Field Label (e.g. University Name)"
                            value={field.label}
                            onChange={(e) => {
                              const newForms = [...(Array.isArray(formData.customForms) ? formData.customForms : [])];
                              if (newForms[index] && typeof newForms[index] === 'object') {
                                newForms[index] = { ...newForms[index], label: e.target.value || '' };
                                setFormData(prev => ({ ...prev, customForms: newForms }));
                              }
                            }}
                            className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-slate-800 font-bold uppercase tracking-tight"
                          />
                        </div>

                        <select
                          value={field.type || 'text'}
                          onChange={(e) => {
                            const newForms = [...(Array.isArray(formData.customForms) ? formData.customForms : [])];
                            if (newForms[index] && typeof newForms[index] === 'object') {
                              newForms[index] = { ...newForms[index], type: e.target.value || 'text' };
                              setFormData(prev => ({ ...prev, customForms: newForms }));
                            }
                          }}
                          className="bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-400 px-3 py-1.5 rounded-lg outline-none focus:border-sky-500/50 uppercase tracking-widest"
                        >
                          <option value="text">Text</option>
                          <option value="textarea">Textarea</option>
                          <option value="select">Dropdown</option>
                          <option value="file">File Upload</option>
                          <option value="checkbox">Checkbox</option>
                          <option value="link">Redirect Link</option>
                        </select>
                        
                        <label className="flex items-center gap-2 cursor-pointer border-l border-slate-800 pl-4 py-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-700 group-hover:text-amber-500 transition-colors">Required</span>
                          <div className="relative">
                            <input 
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => {
                                const newForms = [...(Array.isArray(formData.customForms) ? formData.customForms : [])];
                                if (newForms[index] && typeof newForms[index] === 'object') {
                                  newForms[index] = { ...newForms[index], required: !!e.target.checked };
                                  setFormData(prev => ({ ...prev, customForms: newForms }));
                                }
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-5 h-5 border-2 border-slate-800 rounded-md peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-all flex items-center justify-center">
                              <svg className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          </div>
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              customForms: (Array.isArray(prev.customForms) ? prev.customForms : []).filter(f => f && typeof f === 'object' && f.id !== field.id)
                            }));
                          }}
                          className="p-2 text-slate-800 hover:text-rose-500 transition-all ml-2"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      {field.type === 'select' && (
                        <div className="pl-4 border-l-2 border-sky-500/20 space-y-3">
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Dropdown Options (Comma separated)</p>
                          <input
                            type="text"
                            placeholder="Option 1, Option 2, Option 3"
                            value={Array.isArray(field.options) ? field.options.join(', ') : ''}
                            onChange={(e) => {
                              const newForms = [...(Array.isArray(formData.customForms) ? formData.customForms : [])];
                              if (newForms[index] && typeof newForms[index] === 'object') {
                                newForms[index] = { 
                                  ...newForms[index], 
                                  options: (e.target.value || '').split(',').map(s => s.trim()).filter(Boolean) 
                                };
                                setFormData(prev => ({ ...prev, customForms: newForms }));
                              }
                            }}
                            className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-3 text-xs text-slate-300 focus:outline-none focus:border-sky-500/30"
                          />
                        </div>
                      )}

                      {field.type === 'link' && (
                        <div className="pl-4 border-l-2 border-violet-500/30 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center gap-2">
                            <Link2 size={12} className="text-violet-400" />
                            <p className="text-[9px] font-black text-violet-400/70 uppercase tracking-widest">Redirect URL</p>
                          </div>
                          <input
                            type="url"
                            placeholder="https://..."
                            value={Array.isArray(field.options) && field.options[0] ? field.options[0] : ''}
                            onChange={(e) => {
                              const newForms = [...(Array.isArray(formData.customForms) ? formData.customForms : [])];
                              if (newForms[index] && typeof newForms[index] === 'object') {
                                newForms[index] = { 
                                  ...newForms[index], 
                                  options: [e.target.value || ''] 
                                };
                                setFormData(prev => ({ ...prev, customForms: newForms }));
                              }
                            }}
                            className="w-full bg-slate-950 border border-violet-500/20 rounded-xl px-4 py-3 text-xs text-slate-300 focus:outline-none focus:border-violet-500/50 font-mono"
                          />
                          <p className="text-[8px] font-bold text-slate-700 uppercase tracking-widest">Users will see a button that redirects to this URL when clicked.</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 border border-dashed border-slate-800 rounded-3xl bg-slate-950/50">
                  <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">No custom parameters deployed</p>
                </div>
              )}
            </div>
          </section>

          {/* Ticket Tiers Section */}
          <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-8 shadow-sm">
             <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                <Ticket className="text-[#6366f1]" size={20} /> TICKETING & PRICING
              </h3>
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  ticketTiers: [...(prev.ticketTiers || []), { name: '', price: 0, capacity: 0, requireApproval: false, description: '' }]
                }))}
                className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-[#6366f1]/20 active:scale-[0.98]"
              >
                <PlusCircle size={16} /> Add Ticket Tier
              </button>
            </div>

            <div className="space-y-4">
              {formData.ticketTiers.map((tier, idx) => (
                <div key={idx} className="p-10 bg-slate-950 border border-slate-800 rounded-[2.5rem] space-y-10 relative group shadow-2xl">
                  {/* Delete Button - Top Right */}
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      ticketTiers: prev.ticketTiers.filter((_, i) => i !== idx)
                    }))}
                    className="absolute top-8 right-8 p-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all shadow-lg"
                  >
                    <Trash2 size={20} />
                  </button>

                  <div className="space-y-8 max-w-2xl">
                    <div className="space-y-3">
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Tier Name</label>
                      <input
                        type="text" value={tier.name}
                        onChange={(e) => {
                          const newTiers = [...formData.ticketTiers];
                          newTiers[idx].name = e.target.value;
                          setFormData(prev => ({ ...prev, ticketTiers: newTiers }));
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-3xl px-8 py-5 text-white text-lg focus:outline-none focus:border-[#6366f1]/50 transition-all font-medium placeholder:text-slate-800"
                        placeholder="e.g. Early Bird, VIP Experience"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Price (₹)</label>
                        <div className="relative">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 font-bold">₹</span>
                          <input
                            type="number" value={tier.price}
                            onChange={(e) => {
                              const newTiers = [...formData.ticketTiers];
                              newTiers[idx].price = parseInt(e.target.value) || 0;
                              setFormData(prev => ({ ...prev, ticketTiers: newTiers }));
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-3xl pl-12 pr-8 py-5 text-white text-lg focus:outline-none focus:border-[#6366f1]/50 transition-all font-mono"
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Capacity / Slots</label>
                        <input
                          type="number" value={tier.capacity}
                          onChange={(e) => {
                            const newTiers = [...formData.ticketTiers];
                            newTiers[idx].capacity = parseInt(e.target.value) || 0;
                            setFormData(prev => ({ ...prev, ticketTiers: newTiers }));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-3xl px-8 py-5 text-white text-lg focus:outline-none focus:border-[#6366f1]/50 transition-all font-mono"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    
                    {/* Fee Calculator */}
                    {tier.price > 0 && (
                      <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                             <IndianRupee size={14} />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Platform Fee (8%)</p>
                            <p className="text-xs font-black text-white">₹{Math.round(tier.price * 0.08)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Your Payout</p>
                          <p className="text-lg font-black text-emerald-400">₹{tier.price - Math.round(tier.price * 0.08)}</p>
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      <label className="inline-flex items-center gap-4 cursor-pointer group/verify bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 hover:border-[#6366f1]/30 transition-all">
                        <div className="relative">
                          <input
                            type="checkbox" checked={tier.requireApproval}
                            onChange={(e) => {
                              const newTiers = [...formData.ticketTiers];
                              newTiers[idx].requireApproval = e.target.checked;
                              setFormData(prev => ({ ...prev, ticketTiers: newTiers }));
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-6 h-6 border-2 border-slate-800 rounded-lg peer-checked:bg-[#6366f1] peer-checked:border-[#6366f1] transition-all flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">Require Approval</span>
                          <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">Verify attendees before confirming</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
              {formData.ticketTiers.length === 0 && (
                <div className="text-center p-8 border border-dashed border-slate-800 rounded-3xl bg-slate-950/30">
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Legacy Pricing: Using Global Params</p>
                </div>
              )}
            </div>
          </section>

          {/* Status */}
          <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-8 shadow-sm">
            <h3 className="text-[12px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
              <Globe className="text-emerald-500" size={20} /> PUBLISHING STATUS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { id: 'published', label: 'DEPLOY LIVE', description: 'Immediate public visibility', icon: Star },
                { id: 'draft', label: 'INCUBATING', description: 'Internal restricted access', icon: Monitor },
                { id: 'cancelled', label: 'DEACTIVATED', description: 'Protocol suspended', icon: X }
              ].map(item => (
                <button
                  key={item.id} type="button" onClick={() => setFormData(prev => ({ ...prev, status: item.id }))}
                  className={`w-full text-left p-5 rounded-3xl border transition-all relative overflow-hidden group ${
                    formData.status === item.id 
                    ? 'bg-sky-500 border-sky-400 text-white shadow-xl shadow-sky-900/20' 
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-4 relative z-10">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${formData.status === item.id ? 'bg-white/20' : 'bg-slate-900 group-hover:bg-slate-800'}`}>
                      <item.icon size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest">{item.label}</p>
                      <p className={`text-[9px] font-bold uppercase tracking-widest opacity-60 mt-0.5`}>{item.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

        {/* Theme Engine Block */}
        <section className="bg-slate-900 border border-slate-800 rounded-[3rem] p-12 space-y-10 shadow-2xl shadow-slate-950/20">
            <div className="flex items-center justify-between">
               <h3 className="text-[12px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                <Palette className="text-pink-500" size={24} /> BRANDING & DESIGN
              </h3>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-950 px-4 py-2 rounded-full border border-slate-800">Live Preview Available</p>
            </div>

            <div className="space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Color Palette */}
                <div className="space-y-6">
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Primary Accent Color</label>
                  <div className="flex flex-wrap gap-4">
                    {['#E33B76', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#f97316', '#6366f1', '#1e293b'].map(color => (
                      <button key={color} type="button" onClick={() => setFormData(prev => ({ ...prev, themeConfig: { ...prev.themeConfig, primaryColor: color } }))}
                        className={`w-12 h-12 rounded-full transition-all border-4 ${formData.themeConfig.primaryColor === color ? 'scale-110 border-white shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Display Mode & Fonts */}
                <div className="space-y-6">
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Typography & Contrast</label>
                  <div className="grid grid-cols-2 gap-6">
                    <select
                      value={formData.themeConfig.fontFamily}
                      onChange={(e) => setFormData(prev => ({ ...prev, themeConfig: { ...prev.themeConfig, fontFamily: e.target.value } }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm focus:outline-none focus:border-pink-500/50 transition-all font-medium appearance-none cursor-pointer"
                    >
                      <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                      <option value="Inter">Inter</option>
                      <option value="Outfit">Outfit</option>
                      <option value="Roobert, sans-serif">Roobert</option>
                    </select>
                    
                    <div className="flex bg-slate-950 border border-slate-800 rounded-2xl p-1">
                      {['light', 'dark'].map(mode => (
                        <button key={mode} type="button" onClick={() => setFormData(prev => ({ ...prev, themeConfig: { ...prev.themeConfig, displayMode: mode } }))}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${formData.themeConfig.displayMode === mode ? 'bg-pink-500 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Background Styles */}
              <div className="space-y-6">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Background Atmosphere</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { id: 'pastel-light', label: 'Pastel Light', bg: 'bg-gradient-to-br from-pink-200 to-yellow-200' },
                    { id: 'minimal', label: 'Minimal', bg: 'bg-slate-200' },
                    { id: 'warp', label: 'Quantum Warp', bg: 'bg-slate-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900 to-black border-slate-800 border' },
                    { id: 'video', label: 'Cinematic Video', bg: 'bg-slate-950 border-dashed border-2 border-slate-800' }
                  ].map(style => (
                    <button key={style.id} type="button" onClick={() => setFormData(prev => ({ ...prev, themeConfig: { ...prev.themeConfig, themeStyle: style.id } }))}
                      className={`flex flex-col items-center gap-4 p-4 rounded-[2rem] border-2 transition-all group ${formData.themeConfig.themeStyle === style.id ? 'border-pink-500 bg-pink-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-700'}`}
                    >
                      <div className={`w-full h-20 rounded-2xl ${style.bg} flex items-center justify-center overflow-hidden transition-all group-hover:scale-[1.02]`}>
                        {style.id === 'video' && <PlayCircle className="text-slate-600" size={32} />}
                      </div>
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">{style.label}</span>
                    </button>
                  ))}
                </div>

                {formData.themeConfig.themeStyle === 'video' && (
                  <div className="p-8 bg-slate-950 border border-slate-800 rounded-3xl mt-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between mb-6">
                      <label className="block text-[11px] font-black text-pink-500 uppercase tracking-[0.2em]">Select Background Atmosphere</label>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest border border-slate-800 px-3 py-1 rounded-full bg-slate-900">Optimized 4K / HD</span>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      {[
                        'https://res.cloudinary.com/dlyx0r3nn/video/upload/q_auto,f_auto/v1778008996/9145177-uhd_3840_2160_30fps_1_guvg1w.mp4',
                        'https://res.cloudinary.com/dlyx0r3nn/video/upload/q_auto,f_auto/v1778008998/14471405_3840_2160_30fps_1_i1vy1v.mp4',
                        'https://res.cloudinary.com/dlyx0r3nn/video/upload/q_auto,f_auto/v1778009012/14630687_1920_1080_30fps_1_haizbj.mp4',
                        'https://res.cloudinary.com/dlyx0r3nn/video/upload/q_auto,f_auto/v1778009819/tunnel_1_cpjipb.mp4'
                      ].map((vidUrl, idx) => {
                        // Strip query params or transformations for comparison
                        const isSelected = formData.themeConfig.backgroundVideoUrl?.includes(vidUrl.split('/upload/')[1]);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, themeConfig: { ...prev.themeConfig, backgroundVideoUrl: vidUrl } }))}
                            className={`relative h-24 rounded-2xl overflow-hidden border-2 transition-all group ${isSelected ? 'border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.4)]' : 'border-slate-800 hover:border-slate-600'}`}
                          >
                            <img src={vidUrl.replace('.mp4', '.jpg')} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt="Video Thumbnail" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none">
                               <PlayCircle className="text-white drop-shadow-md" size={24} />
                            </div>
                            {isSelected && (
                              <div className="absolute inset-0 bg-pink-500/20 flex items-center justify-center">
                                <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center shadow-lg">
                                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}

                      {/* Custom Upload Button */}
                      <label className={`relative h-24 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-2xl cursor-pointer hover:border-pink-500/50 transition-all group ${uploading ? 'animate-pulse' : ''}`}>
                        <input type="file" accept="video/mp4,video/webm" className="hidden" disabled={uploading} 
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if(!file) return;
                            setUploading(true);
                            try {
                              const url = await uploadVideoToCloudinary(file);
                              // We can add q_auto to the custom upload too if it's from cloudinary
                              const optimizedUrl = url.includes('cloudinary.com') ? url.replace('/upload/', '/upload/q_auto,f_auto/') : url;
                              setFormData(prev => ({ ...prev, themeConfig: { ...prev.themeConfig, backgroundVideoUrl: optimizedUrl } }));
                            } catch(err) { console.error(err); } finally { setUploading(false); }
                          }} 
                        />
                        {uploading ? <RefreshCw className="animate-spin text-slate-400" size={24} /> : <PlusCircle className="text-slate-600 group-hover:text-pink-500 transition-colors mb-2" size={24} />} 
                        <span className="text-[8px] font-bold text-slate-400 group-hover:text-pink-500 uppercase tracking-widest text-center px-2">
                          {uploading ? 'UPLOADING...' : 'CUSTOM'}
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
        </section>

        {/* Poster / Main Image Block */}
        <section className="bg-slate-900 border border-slate-800 rounded-[3rem] p-12 space-y-10 shadow-2xl shadow-slate-950/20">
            <div className="flex items-center justify-between">
               <h3 className="text-[12px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                <Upload className="text-sky-500" size={24} /> EVENT POSTER
              </h3>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-950 px-4 py-2 rounded-full border border-slate-800">Support: JPG, PNG, WEBP</p>
            </div>
            
            <div className="flex flex-wrap gap-8">
              {formData.images.map((img, idx) => (
                <div key={idx} className="relative group w-48 h-48 rounded-[2rem] overflow-hidden border border-slate-800 shadow-xl transition-all hover:scale-105 duration-500">
                  <img src={img} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt="" />
                  <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent transition-all" />
                  <button 
                    type="button" onClick={() => handleRemoveImage(idx)}
                    className="absolute top-4 right-4 bg-rose-600 text-white p-2.5 rounded-2xl opacity-0 group-hover:opacity-100 transition-animate translate-y-2 group-hover:translate-y-0 shadow-2xl"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              
              <label className={`w-48 h-48 flex flex-col items-center justify-center border-4 border-dashed border-slate-800 rounded-[2rem] cursor-pointer hover:border-sky-500/50 transition-all group ${uploading ? 'animate-pulse' : ''}`}>
                <input type="file" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                <div className="w-16 h-16 rounded-3xl bg-slate-950 border border-slate-800 flex items-center justify-center mb-4 transition-all group-hover:bg-sky-500/10 group-hover:border-sky-500/50 group-hover:scale-110">
                   {uploading ? <RefreshCw size={24} className="text-sky-500 animate-spin" /> : <PlusCircle size={24} className="text-slate-600 group-hover:text-sky-500" />}
                </div>
                <span className="text-[9px] font-black text-slate-600 group-hover:text-sky-500 uppercase tracking-[0.3em]">{uploading ? 'Transmitting...' : 'Link Asset'}</span>
              </label>
            </div>
        </section>

        {/* Media Gallery Block */}
        <section className="bg-slate-900 border border-slate-800 rounded-[3rem] p-12 space-y-10 shadow-2xl shadow-slate-950/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[12px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                <Info className="text-violet-500" size={24} /> MEDIA GALLERY
              </h3>
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-2">Extra photos &amp; videos shown on the event page · Max 150 MB per video</p>
            </div>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-950 px-4 py-2 rounded-full border border-slate-800">Images + Videos</p>
          </div>

          {galleryError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest">
              {galleryError}
            </div>
          )}

          <div className="flex flex-wrap gap-8">
            {formData.mediaGallery.map((item, idx) => (
              <div key={idx} className="relative group w-48 h-48 rounded-[2rem] overflow-hidden border border-slate-800 shadow-xl transition-all hover:scale-105 duration-500 bg-slate-950">
                {item.type === 'video' ? (
                  <video src={item.url} className="w-full h-full object-cover opacity-70" muted playsInline />
                ) : (
                  <img src={item.url} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt="" />
                )}
                <div className="absolute inset-0 flex items-end p-3">
                  <span className="text-[8px] font-black uppercase tracking-widest bg-black/60 text-white px-2 py-1 rounded-full">
                    {item.type === 'video' ? '▶ Video' : '📷 Photo'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, mediaGallery: prev.mediaGallery.filter((_, i) => i !== idx) }))}
                  className="absolute top-4 right-4 bg-rose-600 text-white p-2.5 rounded-2xl opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 shadow-2xl"
                >
                  <X size={16} />
                </button>
              </div>
            ))}

            <label className={`w-48 h-48 flex flex-col items-center justify-center border-4 border-dashed border-slate-800 rounded-[2rem] cursor-pointer hover:border-violet-500/50 transition-all group ${galleryUploading ? 'animate-pulse' : ''}`}>
              <input
                type="file"
                className="hidden"
                accept="image/*,video/*"
                disabled={galleryUploading}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  setGalleryUploading(true);
                  setGalleryError('');
                  try {
                    const isVideo = file.type.startsWith('video/');
                    const url = isVideo
                      ? await uploadVideoToCloudinary(file)
                      : await uploadToCloudinary(file);
                    setFormData(prev => ({
                      ...prev,
                      mediaGallery: [...prev.mediaGallery, { url, type: isVideo ? 'video' : 'image' }]
                    }));
                  } catch (err) {
                    setGalleryError(err.message);
                  } finally {
                    setGalleryUploading(false);
                    e.target.value = '';
                  }
                }}
              />
              <div className="w-16 h-16 rounded-3xl bg-slate-950 border border-slate-800 flex items-center justify-center mb-4 transition-all group-hover:bg-violet-500/10 group-hover:border-violet-500/50 group-hover:scale-110">
                {galleryUploading ? <RefreshCw size={24} className="text-violet-500 animate-spin" /> : <PlusCircle size={24} className="text-slate-600 group-hover:text-violet-500" />}
              </div>
              <span className="text-[9px] font-black text-slate-600 group-hover:text-violet-500 uppercase tracking-[0.3em]">{galleryUploading ? 'Uploading...' : 'Add Photo/Video'}</span>
            </label>
          </div>
        </section>
      </div>


      {/* Global Actions */}
      <div className="pt-12 flex items-center justify-between border-t border-slate-800/50 pb-20">
        <button type="button" onClick={() => window.history.back()} className="px-10 py-5 rounded-[2rem] text-slate-600 text-[11px] font-black uppercase tracking-[0.3em] transition-all hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800">
          Abound Experience
        </button>
        <div className="flex items-center gap-6">
           <div className="text-right hidden md:block">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Authorized Synchronization</p>
              <SessionIdDisplay />
           </div>
           <button 
            type="submit" disabled={loading || uploading}
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-16 py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl shadow-[#6366f1]/30 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-3"
          >
            {loading ? <Lock className="animate-pulse" size={18} /> : (initialData ? 'Synchronize Updates' : (formData.status === 'published' ? 'Execute Deployment' : 'Preserve Protocol'))}
          </button>
        </div>
      </div>
    </form>
  );
};

export default EventForm;

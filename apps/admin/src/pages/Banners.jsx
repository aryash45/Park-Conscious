/**
 * apps/admin/src/pages/Banners.jsx
 *
 * Purpose: Super Admin homepage banners curation dashboard.
 * Allows verified platform owners to query events, toggle featured states,
 * assign timeline schedules (featuredStart/featuredEnd), prioritize slide order,
 * upload premium widescreen graphic banners, and preview live ticket-stubs.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Tv, Search, Calendar, MapPin, Star, Upload, 
  Trash2, RefreshCw, Save, CheckCircle, Clock, 
  AlertCircle, ChevronRight, Image as ImageIcon,
  ArrowRight, Sparkles, AlertTriangle
} from 'lucide-react';
import { eventService, spotlightService } from '../services/api';
import { uploadToCloudinary } from '../utils/cloudinary';


const CampaignStatusBadge = ({ event }) => {
  if (!event.isFeatured) {
    return (
      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
        Inactive
      </span>
    );
  }

  const now = new Date();
  const start = event.featuredStart ? new Date(event.featuredStart) : null;
  const end = event.featuredEnd ? new Date(event.featuredEnd) : null;

  if (start && now < start) {
    return (
      <span className="px-2 py-0.5 rounded bg-amber-500/5 border border-amber-500/10 text-[8px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1">
        <Clock size={8} /> Scheduled
      </span>
    );
  }

  if (end && now > end) {
    return (
      <span className="px-2 py-0.5 rounded bg-rose-500/5 border border-rose-500/10 text-[8px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1">
        <AlertCircle size={8} /> Expired
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded bg-emerald-500/5 border border-emerald-500/10 text-[8px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1 shadow-sm">
      <div className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" /> Active Now
    </span>
  );
};

const Banners = () => {

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, featured, inactive
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [curationMode, setCurationMode] = useState('banners'); // 'banners', 'spotlight'

  // Editor State
  const [isFeatured, setIsFeatured] = useState(false);
  const [featuredTitle, setFeaturedTitle] = useState('');
  const [featuredSubtitle, setFeaturedSubtitle] = useState('');
  const [featuredOrder, setFeaturedOrder] = useState(0);
  const [featuredStart, setFeaturedStart] = useState('');
  const [featuredEnd, setFeaturedEnd] = useState('');
  const [bannerImage, setBannerImage] = useState('');
  
  // Spotlight Curation States
  const [spotlightTitle, setSpotlightTitle] = useState('');
  const [spotlightSubtitle, setSpotlightSubtitle] = useState('');
  const [spotlightBrandPoster, setSpotlightBrandPoster] = useState('');
  const [spotlightEventIds, setSpotlightEventIds] = useState([]);
  const [spotlightSaving, setSpotlightSaving] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchSpotlight = useCallback(async () => {
    try {
      const { data } = await spotlightService.get();
      if (data) {
        setSpotlightTitle(data.title || '');
        setSpotlightSubtitle(data.subtitle || '');
        setSpotlightBrandPoster(data.brandPoster || '');
        setSpotlightEventIds(data.eventIds ? data.eventIds.map(e => e._id || e) : []);
      }
    } catch (err) {
      console.error('Failed to load spotlight details:', err);
    }
  }, []);

  const toggleSpotlightEvent = (id) => {
    setSpotlightEventIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSaveSpotlight = async () => {
    setSpotlightSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (!spotlightTitle) {
      setErrorMsg('Spotlight Title is mandatory.');
      setSpotlightSaving(false);
      return;
    }
    if (!spotlightBrandPoster) {
      setErrorMsg('A widescreen brand poster is mandatory to curate.');
      setSpotlightSaving(false);
      return;
    }

    const payload = {
      title: spotlightTitle,
      subtitle: spotlightSubtitle,
      brandPoster: spotlightBrandPoster,
      eventIds: spotlightEventIds,
      isActive: true
    };

    try {
      await spotlightService.update(payload);
      setSuccessMsg('Homepage brand spotlight successfully updated!');
      await fetchSpotlight();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Spotlight update failed:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Spotlight save failed.');
    } finally {
      setSpotlightSaving(false);
    }
  };

  const handleBrandPosterUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('Brand poster size exceeds 8MB threshold.');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    try {
      const secureUrl = await uploadToCloudinary(file);
      setSpotlightBrandPoster(secureUrl);
      setSuccessMsg('Brand poster uploaded successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setErrorMsg('Cloudinary upload bottleneck encountered. Try manual URL path instead.');
    } finally {
      setUploading(false);
    }
  };

  const fetchEvents = useCallback(async (force = false) => {
    if (force) {
      await Promise.resolve();
      setLoading(true);
    }
    try {
      const { data } = await eventService.getAll();
      const sorted = Array.isArray(data) ? data : [];
      setEvents(sorted);
      
      // Update selected event if edit session is active using functional update to avoid dependencies
      setSelectedEvent(prev => {
        if (!prev) return null;
        const fresh = sorted.find(e => e._id === prev._id);
        return fresh || prev;
      });
    } catch (error) {
      console.error('Failed to load events:', error);
      setErrorMsg('Failed to sync events repository.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      await Promise.resolve();
      if (!active) return;
      fetchEvents(true);
      fetchSpotlight();
    };
    init();
    return () => {
      active = false;
    };
  }, [fetchEvents, fetchSpotlight]);

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setErrorMsg('');
    setSuccessMsg('');

    setIsFeatured(event.isFeatured || false);
    setFeaturedTitle(event.featuredTitle || event.title || '');
    setFeaturedSubtitle(event.featuredSubtitle || event.description || '');
    setFeaturedOrder(event.featuredOrder ?? 0);
    
    // Format dates to YYYY-MM-DDThh:mm for datetime-local input fields
    const formatDateForInput = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().slice(0, 16);
    };

    setFeaturedStart(formatDateForInput(event.featuredStart));
    setFeaturedEnd(formatDateForInput(event.featuredEnd));
    setBannerImage(event.bannerImage || '');
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check size limit (e.g. 8MB)
    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 8MB threshold.');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    try {
      const secureUrl = await uploadToCloudinary(file);
      setBannerImage(secureUrl);
      setSuccessMsg('Banner poster uploaded successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setErrorMsg('Cloudinary upload bottleneck encountered. Try standard URL paste instead.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveCuration = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    // Quick sanity validation
    if (isFeatured && !bannerImage) {
      setErrorMsg('Widescreen graphic (bannerImage) is mandatory to feature.');
      setSaving(false);
      return;
    }

    const payload = {
      isFeatured,
      featuredTitle,
      featuredSubtitle,
      featuredOrder: Number(featuredOrder),
      featuredStart: featuredStart ? new Date(featuredStart).toISOString() : null,
      featuredEnd: featuredEnd ? new Date(featuredEnd).toISOString() : null,
      bannerImage
    };

    try {
      await eventService.update(selectedEvent._id, payload);
      setSuccessMsg('Homepage campaign coordinates successfully updated!');
      await fetchEvents(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Update failed:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Asset mutation failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetCuration = async () => {
    if (!selectedEvent) return;
    if (!window.confirm('Reset all promotion properties and un-feature this experience?')) return;
    
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload = {
      isFeatured: false,
      featuredTitle: '',
      featuredSubtitle: '',
      featuredOrder: 0,
      featuredStart: null,
      featuredEnd: null,
      bannerImage: ''
    };

    try {
      await eventService.update(selectedEvent._id, payload);
      setSuccessMsg('Curation filters cleared. Removed from Handpicked list.');
      
      // Update form
      setIsFeatured(false);
      setFeaturedTitle('');
      setFeaturedSubtitle('');
      setFeaturedOrder(0);
      setFeaturedStart('');
      setFeaturedEnd('');
      setBannerImage('');

      await fetchEvents(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Reset failed:', err);
      setErrorMsg('Failed to wipe campaign variables.');
    } finally {
      setSaving(false);
    }
  };

  // Filtered Events list
  const filteredEvents = events.filter(event => {
    const titleMatch = (event.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    const venueMatch = (event.location?.name || event.venue || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = titleMatch || venueMatch;

    if (filterType === 'featured') {
      return matchesSearch && event.isFeatured;
    }
    if (filterType === 'inactive') {
      return matchesSearch && !event.isFeatured;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-[9px] font-bold uppercase tracking-[0.3em] mb-2">
            <Tv size={10} /> Editorial backoffice
          </div>
          <h1 className="text-3xl font-black text-zinc-100 tracking-tight uppercase flex items-center gap-3">
            Homepage Editorial
          </h1>
          <p className="text-zinc-600 text-xs font-medium mt-1">
            Publish, schedule, prioritize homepage handpicked sliders, and customize widescreen landscape banners.
          </p>
        </div>
      </div>

      {/* Curation Mode Tabs */}
      <div className="flex gap-6 border-b border-white/[0.03] pb-4">
        <button
          onClick={() => setCurationMode('banners')}
          className={`pb-2 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all ${curationMode === 'banners' ? 'border-sky-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          Landing Banners
        </button>
        <button
          onClick={() => setCurationMode('spotlight')}
          className={`pb-2 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all ${curationMode === 'spotlight' ? 'border-sky-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          Brand Spotlight
        </button>
      </div>

      {/* Global Alert messages */}
      {errorMsg && (
        <div className="bg-rose-500/5 border border-rose-500/10 text-rose-400 px-6 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 max-w-7xl animate-bounce">
          <AlertCircle size={16} />
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 px-6 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 max-w-7xl">
          <CheckCircle size={16} />
          {successMsg}
        </div>
      )}

      {/* Primary Workspace Grid */}
      {curationMode === 'banners' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Search & Events Directory (5/12 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card rounded-[2rem] p-6 space-y-6">
            
            {/* Search inputs */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" size={14} />
              <input 
                type="text" 
                placeholder="Search Active Repository..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-900 text-zinc-200 pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-sky-500/20 transition-all font-mono text-[9px] uppercase tracking-widest"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 p-1 bg-slate-950 border border-slate-900 rounded-xl">
              {[
                { type: 'all', label: 'All Events' },
                { type: 'featured', label: 'Curated' },
                { type: 'inactive', label: 'Inactive' }
              ].map(t => (
                <button
                  key={t.type}
                  onClick={() => setFilterType(t.type)}
                  className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filterType === t.type ? 'bg-white/5 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Events List Box */}
            <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="text-sky-500 animate-spin" size={24} />
                  <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest">Querying database...</span>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="py-20 text-center text-zinc-700 text-[10px] font-bold uppercase tracking-widest">
                  No records match filter options.
                </div>
              ) : (
                filteredEvents.map(event => {
                  const isSelected = selectedEvent?._id === event._id;
                  return (
                    <button
                      key={event._id}
                      onClick={() => handleSelectEvent(event)}
                      className={`w-full p-4 rounded-xl border text-left transition-all duration-300 flex items-center gap-4 group ${isSelected ? 'bg-sky-500/5 border-sky-500/20 shadow-xl' : 'bg-slate-900/20 border-slate-900 hover:bg-slate-900/40 hover:border-slate-800'}`}
                    >
                      {/* Event thumbnail */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/5 bg-slate-900 relative shrink-0">
                        <img 
                          src={(event.images && event.images[0]) || event.image || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14'} 
                          className="w-full h-full object-cover grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" 
                          alt="" 
                        />
                      </div>

                      {/* Info and tags */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[8px] font-bold text-zinc-600 font-mono uppercase truncate">
                            {event.location?.name || event.venue || 'TBA'}
                          </span>
                          <CampaignStatusBadge event={event} />
                        </div>
                        <p className={`text-[10px] font-bold uppercase tracking-tight truncate leading-tight transition-colors ${isSelected ? 'text-white' : 'text-zinc-400 group-hover:text-white'}`}>
                          {event.title || 'Untitled'}
                        </p>
                        <div className="flex items-center gap-3">
                          <span className="text-[8px] font-bold text-sky-400 tracking-wider">
                            {event.date ? new Date(event.date).toLocaleDateString() : 'TBA'}
                          </span>
                          {event.isFeatured && (
                            <span className="text-[8px] font-bold text-violet-400 flex items-center gap-0.5">
                              <Star size={8} className="fill-violet-400" /> Slot #{event.featuredOrder || 0}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight size={14} className={`text-zinc-700 transition-transform ${isSelected ? 'translate-x-1 text-sky-400' : 'group-hover:translate-x-1 group-hover:text-zinc-400'}`} />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Curation Editor (7/12 cols) */}
        <div className="lg:col-span-7">
          {!selectedEvent ? (
            /* Selected Empty placeholder */
            <div className="glass-card rounded-[2.5rem] p-24 flex flex-col items-center justify-center text-center space-y-6 border border-dashed border-zinc-800">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-zinc-700 animate-pulse">
                <Tv size={28} />
              </div>
              <div className="max-w-xs space-y-2">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Awaiting Campaign Selection</h3>
                <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest leading-relaxed">
                  Select an experience record from the active list to customize and schedule homepage landing slides.
                </p>
              </div>
            </div>
          ) : (
            /* Primary Editor Form */
            <div className="space-y-8">
              
              {/* Form Container */}
              <div className="glass-card rounded-[2.5rem] p-8 md:p-10 space-y-10">
                <div className="flex items-center justify-between border-b border-white/[0.03] pb-6">
                  <div>
                    <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">ID: {selectedEvent._id}</span>
                    <h2 className="text-lg font-black text-white uppercase tracking-wider mt-1 truncate max-w-sm">
                      {selectedEvent.title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <CampaignStatusBadge event={selectedEvent} />
                  </div>
                </div>

                {/* Primary Feature switch */}
                <label className="p-6 bg-slate-950 border border-slate-900 rounded-3xl flex items-center justify-between group hover:border-sky-500/20 transition-all cursor-pointer">
                  <div className="space-y-1">
                    <p className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <Star size={12} className={isFeatured ? 'fill-sky-400 text-sky-400' : 'text-zinc-600'} /> Homepage handpicked highlight
                    </p>
                    <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-1">
                      Promote this ticket-stub directly onto the landing slide rotation
                    </p>
                  </div>
                  <div className="relative">
                    <input 
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      className="sr-only peer"
                      id="isFeaturedToggle"
                    />
                    <div className="w-12 h-6 bg-zinc-900 border border-zinc-800 rounded-full peer-checked:bg-sky-500 peer-checked:border-sky-400/20 transition-all relative">
                      <div className="absolute top-[3px] left-[3px] w-4 h-4 bg-zinc-100 rounded-full transition-all" style={{ transform: isFeatured ? 'translateX(24px)' : 'translateX(0)' }} />
                    </div>
                  </div>
                </label>

                {/* Promotional editor variables */}
                {isFeatured && (
                  <div className="space-y-8 animate-in fade-in zoom-in duration-300">
                    
                    {/* Widescreen Banner Image uploader */}
                    <div className="space-y-4">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">widescreen banner poster (21:9 ratio suggested)</label>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 relative h-40 bg-slate-950 border border-slate-900 rounded-3xl flex flex-col items-center justify-center group overflow-hidden border-dashed hover:border-sky-500/20 transition-all">
                          {bannerImage ? (
                            <>
                              <img src={bannerImage} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-all duration-700" alt="Banner Poster" />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                <label className="bg-sky-500 hover:bg-sky-400 text-zinc-950 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 shadow-lg">
                                  <Upload size={12} /> Replace File
                                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                                </label>
                                <button
                                  onClick={() => setBannerImage('')}
                                  className="bg-rose-500/20 border border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                                >
                                  <Trash2 size={12} /> Remove
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="text-center p-8 space-y-4">
                              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center mx-auto text-zinc-600 group-hover:text-sky-400 transition-colors">
                                {uploading ? <RefreshCw className="animate-spin text-sky-500" size={20} /> : <Upload size={20} />}
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-sky-400 hover:text-sky-300 uppercase tracking-widest cursor-pointer transition-colors block">
                                  Select file from local disk
                                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                                </label>
                                <p className="text-[8px] font-bold text-zinc-700 uppercase tracking-widest mt-1.5">Maximum size 8MB · aspect ratio constraints enforced on landing slider</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Direct input Paste */}
                        <div className="space-y-4 flex flex-col justify-center">
                          <div className="space-y-2">
                            <label className="block text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">direct image URL path</label>
                            <input 
                              type="url"
                              value={bannerImage}
                              onChange={(e) => setBannerImage(e.target.value)}
                              placeholder="https://images.unsplash.com/..."
                              className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-4 py-3.5 text-white text-xs font-mono focus:outline-none focus:border-sky-500/30"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Form Input properties */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Priority selector */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">carousel priority order</label>
                        <input 
                          type="number"
                          min="0"
                          max="999"
                          value={featuredOrder}
                          onChange={(e) => setFeaturedOrder(Number(e.target.value))}
                          placeholder="e.g. 0 (highest)"
                          className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-6 py-4 text-white text-sm focus:outline-none focus:border-sky-500/30 font-mono font-bold"
                        />
                        <span className="text-[8px] font-bold text-zinc-700 uppercase tracking-widest mt-1.5 block ml-1">Lower value sorts first (0, 1, 2...)</span>
                      </div>

                      {/* Start Date selection */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">campaign start schedule</label>
                        <input 
                          type="datetime-local"
                          value={featuredStart}
                          onChange={(e) => setFeaturedStart(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-6 py-4 text-white text-xs focus:outline-none focus:border-sky-500/30 font-mono"
                        />
                        <span className="text-[8px] font-bold text-zinc-700 uppercase tracking-widest mt-1.5 block ml-1">Leave empty for instant start</span>
                      </div>

                      {/* End Date selection */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">campaign end schedule</label>
                        <input 
                          type="datetime-local"
                          value={featuredEnd}
                          onChange={(e) => setFeaturedEnd(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-6 py-4 text-white text-xs focus:outline-none focus:border-sky-500/30 font-mono"
                        />
                        <span className="text-[8px] font-bold text-zinc-700 uppercase tracking-widest mt-1.5 block ml-1">Leave empty for infinite run</span>
                      </div>
                    </div>

                    {/* Headline and tags */}
                    <div className="space-y-6 pt-4 border-t border-white/[0.03]">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">featured card title (keep short)</label>
                        <input 
                          type="text"
                          value={featuredTitle}
                          onChange={(e) => setFeaturedTitle(e.target.value)}
                          placeholder="e.g. AFSANA COCKTAILS 2026"
                          className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-6 py-4 text-white text-sm focus:outline-none focus:border-sky-500/30 font-bold uppercase tracking-tight"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">curated teaser preview (about experience)</label>
                        <textarea 
                          rows="4"
                          value={featuredSubtitle}
                          onChange={(e) => setFeaturedSubtitle(e.target.value)}
                          placeholder="Write a custom immersive experience about preview text that fits the stub details..."
                          className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-6 py-4 text-white text-xs focus:outline-none focus:border-sky-500/30 leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Form CTA Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-6 border-t border-white/[0.03]">
                  <button
                    onClick={handleSaveCuration}
                    disabled={saving}
                    className="w-full sm:flex-1 bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/30 text-zinc-950 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-xl shadow-sky-950/20 active:scale-[0.98]"
                  >
                    {saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                    {saving ? 'Transacting rules...' : 'Commit Curation coordinates'}
                  </button>
                  {selectedEvent.isFeatured && (
                    <button
                      onClick={handleResetCuration}
                      disabled={saving}
                      className="w-full sm:w-auto bg-zinc-900 border border-zinc-800 text-rose-500 hover:bg-rose-500 hover:text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 size={14} /> Un-feature Event
                    </button>
                  )}
                </div>
              </div>

              {/* HIGH-FIDELITY LIVE TICKET-STUB SLIDER PREVIEW */}
              {isFeatured && bannerImage && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sky-400 text-[9px] font-bold uppercase tracking-[0.3em] ml-1">
                    <Sparkles size={10} className="animate-pulse" /> Live Ticket-Stub homepage simulation
                  </div>
                  
                  {/* Simulated Ticket Card Wrapper */}
                  <div className="w-full bg-[#0e0f14] border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col lg:flex-row min-h-[300px] select-none text-left">
                    
                    {/* Visual transparent perforations (notches) */}
                    {/* Top Desk/Right Mobile Punch */}
                    <div className="absolute left-[32%] top-[-8px] hidden lg:block w-4 h-4 bg-[#050508] border border-white/5 rounded-full z-20" />
                    {/* Bottom Desk/Left Mobile Punch */}
                    <div className="absolute left-[32%] bottom-[-8px] hidden lg:block w-4 h-4 bg-[#050508] border border-white/5 rounded-full z-20" />

                    {/* Left Column: Details Stub (32%) */}
                    <div className="lg:w-[32%] p-6 flex flex-col justify-between bg-[#13141c] relative z-10 shrink-0 border-b lg:border-b-0 lg:border-r border-dashed border-white/10">
                      <div className="space-y-4">
                        {/* Event Category Tag */}
                        <span className="px-2.5 py-0.5 rounded-full border border-sky-400/20 bg-sky-400/5 text-[8px] font-bold uppercase tracking-widest text-sky-400 inline-block">
                          {selectedEvent.category || 'FEATURED'}
                        </span>

                        {/* Title */}
                        <h3 className="text-white text-md font-black uppercase tracking-tight line-clamp-2 leading-tight">
                          {featuredTitle || 'UNTITLED HIGHLIGHT'}
                        </h3>

                        {/* Dynamic preview about experience */}
                        <div className="space-y-1">
                          <span className="text-[7px] font-bold text-zinc-600 uppercase tracking-widest block leading-none">About Experience</span>
                          <p className="text-[9px] text-zinc-500 font-medium leading-relaxed line-clamp-3 uppercase">
                            {featuredSubtitle || 'No curated description text assigned.'}
                          </p>
                        </div>
                      </div>

                      {/* Ticket Footer details */}
                      <div className="pt-6 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-zinc-800 border border-white/5 flex items-center justify-center text-[9px] font-bold text-zinc-100">
                            {selectedEvent.hosts?.[0]?.name?.charAt(0) || 'P'}
                          </div>
                          <div>
                            <p className="text-[7px] font-bold text-zinc-600 uppercase tracking-widest leading-none">Host Profile</p>
                            <p className="text-[8px] font-black text-zinc-300 uppercase truncate max-w-[120px] leading-none mt-1">
                              {selectedEvent.hosts?.[0]?.name || 'BACKSTAGE'}
                            </p>
                          </div>
                        </div>

                        {/* Metadata row */}
                        <div className="flex items-center justify-between text-[8px] font-bold text-zinc-500 uppercase tracking-wider pt-2 border-t border-white/[0.04]">
                          <span className="text-sky-400">₹{selectedEvent.price || 0} onwards</span>
                          <span>{selectedEvent.date ? new Date(selectedEvent.date).toLocaleDateString() : 'TBA'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Landscape Widescreen Graphic (68%) */}
                    <div className="lg:w-[68%] relative h-64 lg:h-auto overflow-hidden group/slide shrink-0 bg-zinc-950">
                      <img 
                        src={bannerImage || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14'} 
                        className="w-full h-full object-cover opacity-100 transform scale-100 group-hover/slide:scale-[1.02] transition-transform duration-[1200ms]"
                        alt=""
                      />
                      
                      {/* Interactive Button overlay inside simulation */}
                      <div className="absolute bottom-6 right-6 z-20">
                        <span className="bg-white/10 hover:bg-white text-white hover:text-zinc-950 border border-white/20 hover:border-white px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-xl backdrop-blur-md">
                          Enter Experience <ArrowRight size={10} />
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}
        </div>

      </div>
      ) : (
        /* Dynamic Brand Spotlight Showcase Curation (contrasting stark white Option A theme) */
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
            {/* Left Side: Brand Details & Poster Curation Form (7/12 columns) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="glass-card rounded-[2.5rem] p-8 md:p-10 space-y-8">
                <div className="border-b border-white/[0.03] pb-4">
                  <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Sparkles size={16} className="text-sky-400" /> Branding Parameters
                  </h2>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">Configure co-branded headings and flagship visual poster assets.</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Spotlight Showcase Title</label>
                    <input 
                      type="text"
                      value={spotlightTitle}
                      onChange={(e) => setSpotlightTitle(e.target.value)}
                      placeholder="e.g. Pitchin' 180 Highlights"
                      className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-6 py-4 text-white text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-sky-500/30"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Showcase Subtitle / Tagline</label>
                    <textarea 
                      rows="3"
                      value={spotlightSubtitle}
                      onChange={(e) => setSpotlightSubtitle(e.target.value)}
                      placeholder="e.g. Curated multi-city startup pitch competitions and elite networking chapters."
                      className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-6 py-4 text-white text-xs leading-relaxed focus:outline-none focus:border-sky-500/30"
                    />
                  </div>

                  {/* Brand Poster Upload */}
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">widescreen brand poster (Suggested 21:9 ratio)</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2 relative h-44 bg-slate-950 border border-slate-900 rounded-3xl flex flex-col items-center justify-center group overflow-hidden border-dashed hover:border-sky-500/20 transition-all">
                        {spotlightBrandPoster ? (
                          <>
                            <img src={spotlightBrandPoster} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-all duration-700" alt="Brand Poster" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                              <label className="bg-sky-500 hover:bg-sky-400 text-zinc-950 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 shadow-lg">
                                <Upload size={12} /> Replace File
                                <input type="file" className="hidden" accept="image/*" onChange={handleBrandPosterUpload} disabled={uploading} />
                              </label>
                              <button
                                onClick={() => setSpotlightBrandPoster('')}
                                className="bg-rose-500/20 border border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                              >
                                <Trash2 size={12} /> Remove
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-8 space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center mx-auto text-zinc-600 group-hover:text-sky-400 transition-colors">
                              {uploading ? <RefreshCw className="animate-spin text-sky-500" size={20} /> : <Upload size={20} />}
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-sky-400 hover:text-sky-300 uppercase tracking-widest cursor-pointer transition-colors block">
                                Select brand file
                                <input type="file" className="hidden" accept="image/*" onChange={handleBrandPosterUpload} disabled={uploading} />
                              </label>
                              <p className="text-[7px] font-bold text-zinc-700 uppercase tracking-widest mt-1.5">Maximum size 8MB · widescreen aspect ratios are styled dynamically</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3 flex flex-col justify-center">
                        <div className="space-y-1">
                          <label className="block text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">direct poster image URL path</label>
                          <input 
                            type="url"
                            value={spotlightBrandPoster}
                            onChange={(e) => setSpotlightBrandPoster(e.target.value)}
                            placeholder="https://images.unsplash.com/..."
                            className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-4 py-3 text-white text-xs font-mono focus:outline-none focus:border-sky-500/30"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/[0.03]">
                  <button
                    onClick={handleSaveSpotlight}
                    disabled={spotlightSaving}
                    className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/30 text-zinc-950 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-xl active:scale-[0.98]"
                  >
                    {spotlightSaving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                    {spotlightSaving ? 'Transacting Brand details...' : 'Commit Spotlight configuration'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Side: Event Selection Checkbox Array (5/12 columns) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="glass-card rounded-[2.5rem] p-6 space-y-6">
                <div className="border-b border-white/[0.03] pb-4">
                  <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Star size={16} className="text-sky-400" /> Bind Spotlight Events
                  </h2>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">Select and check multiple events to render in the co-branded editions slider track.</p>
                </div>

                {/* Event Search */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" size={14} />
                  <input 
                    type="text" 
                    placeholder="Query events to bind..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-900 text-zinc-200 pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-sky-500/20 transition-all font-mono text-[9px] uppercase tracking-widest"
                  />
                </div>

                {/* Selection Summary */}
                <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4 flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                  <span className="text-zinc-500">Currently selected events</span>
                  <span className="text-sky-400 font-mono bg-sky-950/20 px-2 py-0.5 rounded border border-sky-900/30">
                    {spotlightEventIds.length} event(s)
                  </span>
                </div>

                {/* Checkbox Event list */}
                <div className="space-y-2 overflow-y-auto max-h-[450px] pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                  {events.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())).map(event => {
                    const isChecked = spotlightEventIds.includes(event._id);
                    return (
                      <label
                        key={event._id}
                        className={`w-full p-4 rounded-xl border text-left transition-all duration-300 flex items-center justify-between gap-4 cursor-pointer group ${isChecked ? 'bg-sky-500/5 border-sky-500/20' : 'bg-slate-900/20 border-slate-900 hover:bg-slate-900/40 hover:border-slate-800'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Event Thumbnail */}
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/5 bg-slate-900 shrink-0">
                            <img 
                              src={(event.images && event.images[0]) || event.image || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14'} 
                              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" 
                              alt="" 
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-white uppercase tracking-tight truncate">{event.title}</p>
                            <p className="text-[7.5px] font-bold text-zinc-600 uppercase tracking-widest truncate mt-0.5">{event.location?.name || event.venue || 'TBA'}</p>
                          </div>
                        </div>

                        {/* Custom stylized Checkbox */}
                        <div className="relative shrink-0">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSpotlightEvent(event._id)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isChecked ? 'bg-sky-500 border-sky-400 text-zinc-950' : 'border-zinc-800 bg-zinc-900/40 group-hover:border-zinc-700'}`}>
                            {isChecked && <CheckCircle size={12} className="stroke-[3]" />}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* OPTION A STARK-WHITE HOMEPAGE PREVIEW SIMULATOR */}
          {spotlightBrandPoster && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sky-400 text-[9px] font-bold uppercase tracking-[0.3em] ml-1">
                <Sparkles size={10} className="animate-pulse" /> Live Skillbox Light Theme Simulation
              </div>

              {/* Stark White Card Container simulating the homepage theme contrast */}
              <div className="w-full bg-[#ffffff] border-y border-zinc-150 py-14 px-8 md:px-12 shadow-md text-left select-none text-[#0c0d12] transition-all">
                
                {/* Flex Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                  {/* Left Column: Big Brand Poster Banner (38% / 5-cols) */}
                  <div className="lg:col-span-5 flex flex-col h-full">
                    <div className="w-full h-full min-h-[400px] lg:min-h-[480px] rounded-[2rem] overflow-hidden border border-zinc-200 shadow-xl relative bg-zinc-50">
                      <img src={spotlightBrandPoster} className="w-full h-full object-cover" alt="" />
                    </div>
                  </div>

                  {/* Right Column: Details & Dynamic Slider list (62% / 7-cols) */}
                  <div className="lg:col-span-7 flex flex-col justify-between py-2 space-y-6">
                    {/* Top Area Details */}
                    <div>
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#ff385c]">
                        #1 in Spotlight Series
                      </span>
                      <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-[#0c0d12] mt-2 leading-tight">
                        {spotlightTitle || 'Partner Curation Series'}
                      </h3>
                      <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mt-1 max-w-xl">
                        {spotlightSubtitle || 'Curated partner experiences with direct registration.'}
                      </p>

                      {/* CTA Mockup */}
                      <div className="flex items-center gap-4 mt-6">
                        <div className="bg-[#0c0d12] text-white px-6 py-2.5 rounded-full text-[8.5px] font-black uppercase tracking-[0.2em] shadow-md flex items-center gap-2">
                          Book Now <ArrowRight size={10} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-800">
                          ₹999 Onwards*
                        </span>
                      </div>
                    </div>

                    {/* Sibling Slider Mockup */}
                    <div className="pt-6 border-t border-zinc-100">
                      <span className="text-[8px] font-black text-zinc-400 uppercase tracking-[0.25em] block mb-3">Curated Editions Slider Showcase</span>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {spotlightEventIds.length === 0 ? (
                          <div className="col-span-3 py-10 text-center text-zinc-400 border border-dashed border-zinc-200 rounded-xl text-[9px] font-bold uppercase tracking-widest">
                            No checked events. Toggle events on the right to populate the series.
                          </div>
                        ) : (
                          events.filter(e => spotlightEventIds.includes(e._id)).slice(0, 3).map(event => (
                            <div key={event._id} className="relative flex flex-col bg-[#0E0E10] border border-white/5 rounded-[1.2rem] overflow-hidden shadow-xl text-left">
                              <div className="relative w-full overflow-hidden bg-slate-900" style={{ aspectRatio: '3/4' }}>
                                <img src={(event.images && event.images[0]) || event.image} className="w-full h-full object-cover" alt="" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0E0E10] via-[#0E0E10]/20 to-transparent"></div>
                                <div className="absolute top-2 right-2 z-20">
                                  <div className="h-5 px-2 rounded-full bg-black/70 backdrop-blur-md border border-white/10 flex items-center">
                                    <span className="text-[7.5px] font-black uppercase tracking-widest text-white">
                                      ₹{event.price || 0}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="px-3.5 py-3 space-y-1">
                                <p className="text-indigo-400 text-[6.5px] font-black uppercase tracking-[0.25em]">
                                  {Array.isArray(event.category) ? event.category[0] : event.category || "Featured"}
                                </p>
                                <h4 className="text-[10px] font-black text-white uppercase tracking-tighter leading-tight truncate">
                                  {event.title}
                                </h4>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Banners;

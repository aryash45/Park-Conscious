/**
 * apps/events/src/pages/Event.Page.jsx
 *
 * Purpose: Dedicated details page for a specific event.
 * Displays all event information including hosts, media gallery, and booking options.
 * Integrates the BookingModal for the end-user ticket checkout flow.
 */
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useSWR from "swr";
import { backendAxios } from "../axios";
import DefaultlayoutHoc from "../layout/Default.layout";
import BookingModal from "../components/Booking/BookingModal.jsx";
import PremiumBackground from "../components/PremiumBackground";
import { 
  MapPin, Ticket, X, 
  Calendar, Clock, Users, ArrowUpRight, Share2, Instagram, Globe, Link2
} from "lucide-react";
import { Helmet } from "react-helmet";
import { getEventUrlId } from "../utils/eventUrl";
import { getOgImageUrl } from "../utils/ogImage";

/**
 * Inject Cloudinary transformations into a Cloudinary URL.
 */
const clUrl = (url, type = 'image') => {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  // Use f_mp4 for videos to ensure maximum compatibility across browsers
  const transforms = type === 'video' ? 'f_mp4,q_auto,vc_auto' : 'q_auto,f_auto';
  return url.replace('/upload/', `/upload/${transforms}/`);
};

const eventMatchesRoute = (data, routeId) => {
  if (!data || !routeId) return false;
  const rid = String(routeId);
  return [data.slug, data._id, data.id].some((key) => key != null && String(key) === rid);
};

const normalizeEventData = (rawEvent) => ({
  ...rawEvent,
  displayTitle: rawEvent.title || rawEvent.name || "Untitled",
  displayDate: rawEvent.date || rawEvent.createdAt,
  displayLocation: rawEvent.location?.name || rawEvent.locationName || rawEvent.venue || "TBA",
  displayAddress: rawEvent.location?.address || rawEvent.locationAddress || "",
  displayDescription: rawEvent.description || "",
  hosts: Array.isArray(rawEvent.hosts) ? rawEvent.hosts : [],
  ticketTiers: Array.isArray(rawEvent.ticketTiers) ? rawEvent.ticketTiers : [],
  mediaGallery: Array.isArray(rawEvent.mediaGallery) ? rawEvent.mediaGallery : [],
});

const EventPage = () => {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState(null);
  const [liveTheme, setLiveTheme] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'UPDATE_THEME') {
        setLiveTheme(e.data.themeConfig);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // SWR Fetcher
  const fetcher = url => backendAxios.get(url).then(res => res.data);

  // SWR Hook for zero-latency loading if preloaded
  const { data: rawEvent, error, isLoading } = useSWR(`/api/events?id=${id}`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000
  });

  // Handle Fetch Errors
  useEffect(() => {
    if (error) {
      console.error("Error fetching event:", error);
      navigate("/");
    }
  }, [error, navigate]);

  // Redirect ObjectId (or stale) URLs to canonical slug URL
  useEffect(() => {
    if (!rawEvent?.slug || id === rawEvent.slug) return;
    const search = window.location.search;
    navigate(`/event/${rawEvent.slug}${search}`, { replace: true });
  }, [rawEvent, id, navigate]);

  // Apply cached/fetched event + theme atomically (avoids id-reset racing with SWR cache)
  useEffect(() => {
    window.scrollTo(0, 0);

    if (!rawEvent || !eventMatchesRoute(rawEvent, id)) {
      setEvent(null);
      setLiveTheme(null);
      setSelectedTier(null);
      return;
    }

    const normalized = normalizeEventData(rawEvent);
    setEvent(normalized);
    setLiveTheme(normalized.themeConfig ?? null);
    if (normalized.ticketTiers.length > 0) {
      setSelectedTier(normalized.ticketTiers[0]);
    } else {
      setSelectedTier(null);
    }
  }, [id, rawEvent]);

  const themeConfig = liveTheme ?? event?.themeConfig;

  if ((isLoading && !rawEvent) || !event) {
    return (
      <div className="bg-[#050507] min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const dateObj = new Date(event.displayDate);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNum = dateObj.getDate();
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'long' });
  
  // Format the time display: Use user-defined startTime or fallback to Date object
  const timeStr = event.startTime 
    ? (() => {
        const [h, m] = event.startTime.split(':');
        const hours = parseInt(h);
        const suffix = hours >= 12 ? 'PM' : 'AM';
        const h12 = hours % 12 || 12;
        return `${h12}:${m} ${suffix}`;
      })()
    : dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const hostsList = Array.isArray(event.hosts) ? event.hosts : [];
  const primaryColor = themeConfig?.primaryColor || '#E33B76';
  const displayMode = themeConfig?.displayMode || 'light';
  
  const textTitleClass = displayMode === 'dark' ? 'text-white' : 'text-slate-900';
  const textSubtitleClass = displayMode === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const textBodyClass = displayMode === 'dark' ? 'text-slate-300' : 'text-slate-700';
  const cardBgClass = displayMode === 'dark' ? 'bg-black/40 border border-white/10 backdrop-blur-xl' : 'glass-card-light';

  // -- SEO: JSON-LD Schema Generation --
  const generateEventSchema = () => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": event.displayTitle,
      "description": event.displayDescription,
      "image": clUrl(event.images?.[0] || event.image),
      "startDate": event.displayDate,
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": event.isOnline ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
      "location": event.isOnline ? {
        "@type": "VirtualLocation",
        "url": window.location.href
      } : {
        "@type": "Place",
        "name": event.displayLocation,
        "address": {
          "@type": "PostalAddress",
          "streetAddress": event.displayAddress || event.displayLocation,
          "addressCountry": "IN"
        }
      }
    };

    if (event.ticketTiers?.length > 0) {
      const minPrice = Math.min(...event.ticketTiers.map(t => t.price));
      const maxPrice = Math.max(...event.ticketTiers.map(t => t.price));
      schema.offers = {
        "@type": "AggregateOffer",
        "lowPrice": minPrice,
        "highPrice": maxPrice,
        "priceCurrency": "INR",
        "availability": "https://schema.org/InStock",
        "url": window.location.href
      };
    }

    if (event.hosts?.length > 0) {
      schema.organizer = {
        "@type": "Organization",
        "name": event.hosts[0].name,
        "url": event.hosts[0].socialLink
      };
    }

    return JSON.stringify(schema);
  };

  return (
    <PremiumBackground themeConfig={themeConfig}>
      <Helmet>
        <link rel="canonical" href={`https://events.parkconscious.in/event/${getEventUrlId(event)}`} />
        <title>{`${event.displayTitle} | BACKSTAGE`}</title>
        <meta name="description" content={event.displayDescription?.substring(0, 160) || "Join us for an exclusive event experience."} />
        <meta property="og:title" content={event.displayTitle} />
        <meta property="og:description" content={event.displayDescription?.substring(0, 160) || "Join us for an exclusive event experience."} />
        <meta property="og:image" content={getOgImageUrl(event)} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="1600" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={event.displayTitle} />
        <meta name="twitter:description" content={event.displayDescription?.substring(0, 160) || "Join us for an exclusive event experience."} />
        <meta name="twitter:image" content={getOgImageUrl(event)} />
        
        {/* JSON-LD Schema for Events */}
        <script type="application/ld+json">
          {generateEventSchema()}
        </script>
      </Helmet>
      <div className={`pb-32 font-['Inter'] ${displayMode === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
        <div className="container mx-auto px-6 md:px-12 lg:px-32 pt-24 lg:pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
            
            {/* Left Column: Poster & Action */}
            <div className="lg:col-span-5 space-y-12">
              <div className="sticky top-12 space-y-12">
                <div className="relative rounded-[2rem] overflow-hidden border border-white/60 shadow-2xl shadow-pink-500/10">
                  <img 
                    src={clUrl(event.images?.[0] || event.image)} 
                    className="w-full object-cover" 
                    alt={event.displayTitle}
                  />
                </div>

                {/* Booking Information Card */}
                <div className={`${cardBgClass} rounded-[3rem] p-10 space-y-10`}>
                  <div className="text-center">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.4em] text-pink-500/80">Booking Information</h3>
                  </div>

                  <div className="space-y-4 px-2">
                    {event.ticketTiers && event.ticketTiers.length > 0 ? (
                      <div className="space-y-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Select Ticket Tier</p>
                        <div className="space-y-3">
                          {event.ticketTiers.map((tier, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedTier(tier)}
                              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                selectedTier?.name === tier.name 
                                  ? 'shadow-sm' 
                                  : 'bg-white/40 border-white/60'
                              }`}
                              style={selectedTier?.name === tier.name ? { backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}40` } : {}}
                            >
                              <div className="text-left">
                                <p className={`text-sm font-bold ${textTitleClass}`}>{tier.name}</p>
                                {tier.description && <p className={`text-[10px] mt-1 ${textSubtitleClass}`}>{tier.description}</p>}
                              </div>
                              <div className="text-right">
                                <p className={`text-lg font-heading font-bold ${textTitleClass}`}>₹{tier.price}</p>
                                <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${textSubtitleClass}`}>{tier.capacity} Slots</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Ticket Availability</p>
                        <div className="flex items-baseline justify-between border-b border-black/5 pb-6">
                          <span className={`text-5xl font-bold font-heading leading-none ${textTitleClass}`}>{event.capacity || 0}</span>
                          <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${textSubtitleClass}`}>Global Capacity</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-4 pt-2">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        const label = document.getElementById('share-label-left');
                        if(label) label.innerText = "COPIED!";
                        setTimeout(() => { if(label) label.innerText = "SHARE EVENT LINK"; }, 2000);
                      }}
                      className={`w-full py-5 rounded-3xl border text-[9px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all group ${displayMode === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white/40 border-white/60 text-slate-700 hover:bg-white/60'}`}
                    >
                      <span id="share-label-left">Share Event Link</span>
                      <Share2 size={14} className={`${displayMode === 'dark' ? 'text-slate-400' : 'text-slate-400'} group-hover:text-pink-500 transition-colors`} />
                    </button>

                    <button 
                      onClick={() => setIsBookingOpen(true)}
                      className="w-full py-5 rounded-full text-white text-[11px] font-black uppercase tracking-[0.4em] flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-xl"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Ticket size={18} />
                      <span>Book Now</span>
                    </button>
                  </div>

                  <p className="text-center text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] leading-relaxed max-w-xs mx-auto">
                    Guaranteed Entry • Non-Refundable Policy • Valid ID Required
                  </p>
                </div>

                <div className="space-y-6">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">Presented By</h3>
                  <div className="space-y-5">
                    {hostsList.length > 0 ? hostsList.map((host, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full border border-white/60 bg-white/40 shadow-sm overflow-hidden flex-shrink-0">
                            {host.image ? (
                              <img src={clUrl(host.image)} className="w-full h-full object-cover" alt={host.name} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-pink-500 bg-white/50">
                                {host.name ? host.name[0]?.toUpperCase() : 'H'}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${textTitleClass}`}>{host.name || "Anonymous Host"}</p>
                            <p className={`text-[10px] font-medium ${textSubtitleClass}`}>{host.role}</p>
                          </div>
                        </div>
                        
                        {host.socialLink && (
                          <a 
                            href={host.socialLink.startsWith('http') ? host.socialLink : `https://${host.socialLink}`} 
                            target="_blank" rel="noreferrer"
                            className="w-10 h-10 rounded-full bg-white/40 border border-white/60 flex items-center justify-center text-slate-400 hover:text-pink-500 hover:border-pink-300 transition-all shadow-sm group/social"
                            title="Visit Host Profile"
                          >
                            {host.socialLink.includes('instagram.com') ? <Instagram size={16} /> : <Link2 size={16} />}
                          </a>
                        )}
                      </div>
                    )) : (
                      <div className="flex items-center gap-4 opacity-70">
                        <div className="w-10 h-10 rounded-full border border-white/60 bg-white/40 flex items-center justify-center shadow-sm">
                          <Users size={16} className="text-slate-500" />
                        </div>
                        <p className={`text-sm font-bold ${textTitleClass}`}>Backstage Events Official</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Information */}
            <div className="lg:col-span-7 space-y-16">
              <div className="space-y-10">
                <h1 className={`text-5xl md:text-7xl font-heading font-extrabold tracking-tight drop-shadow-sm ${textTitleClass}`}>
                  {event.displayTitle}
                </h1>
                
                {/* Logistics Refinement */}
                <div className="space-y-10">
                  <div className="flex items-start gap-6">
                    <div className={`flex-shrink-0 w-16 h-16 ${cardBgClass} rounded-[1.5rem] flex flex-col items-center justify-center overflow-hidden p-0`}>
                      <div className="w-full py-1 text-center" style={{ backgroundColor: primaryColor }}>
                        <span className="text-[8px] font-black uppercase tracking-widest text-white">{event.isTBA ? 'TBA' : monthName}</span>
                      </div>
                      <div className={`flex-1 flex items-center justify-center w-full ${displayMode === 'dark' ? 'bg-white/5' : 'bg-white/40'} backdrop-blur-md`}>
                        {event.isTBA ? (
                          <Clock size={20} className={displayMode === 'dark' ? 'text-white' : 'text-slate-900'} />
                        ) : (
                          <span className={`text-xl font-bold ${displayMode === 'dark' ? 'text-white' : 'text-slate-900'}`}>{dayNum}</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 pt-2">
                      <h4 className={`text-xl font-bold tracking-tight ${textTitleClass}`}>
                        {event.isTBA ? 'Date to be Announced' : `${dayName}, ${monthName} ${dayNum}`}
                      </h4>
                      <p className={`text-sm font-medium flex items-center gap-2 ${textSubtitleClass}`}>
                        <Clock size={14} /> {event.isTBA ? 'Time TBA' : `${timeStr} GMT+5:30`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-6">
                    <div className={`flex-shrink-0 w-16 h-16 ${cardBgClass} rounded-[1.5rem] flex items-center justify-center`}>
                      {event.isOnline ? <Globe size={24} color={primaryColor} /> : <MapPin size={24} color={primaryColor} />}
                    </div>
                    <div className="space-y-1 pt-2">
                      {event.isOnline ? (
                        <div className={`flex items-center gap-2 text-xl font-bold ${textTitleClass}`}>
                          Digital Experience
                        </div>
                      ) : (
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.displayLocation)}`}
                          target="_blank" rel="noreferrer"
                          className={`flex items-center gap-2 text-xl font-bold transition-all group ${textTitleClass}`}
                        >
                            {event.location?.name || event.venue || "NCR"}
                            <ArrowUpRight size={18} color={primaryColor} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                        </a>
                      )}
                      <p className={`text-sm font-medium ${textSubtitleClass}`}>
                        {event.isOnline ? 'Access link shared after booking' : event.displayLocation}
                      </p>
                    </div>
                  </div>
                </div>

                {/* About Section */}
                <div className="space-y-6 pt-12 border-t border-black/5">
                  <h3 className={`text-[11px] font-medium uppercase tracking-[0.2em] ${textSubtitleClass}`}>About the Experience</h3>
                  <p className={`leading-relaxed text-lg font-medium whitespace-pre-wrap ${textBodyClass}`}>
                    {event.displayDescription || "No detailed description provided."}
                  </p>
                </div>

                {/* Media Gallery Section */}
                {event.mediaGallery && event.mediaGallery.length > 0 && (
                  <div className="space-y-6 pt-12 border-t border-black/5">
                    <h3 className={`text-[11px] font-medium uppercase tracking-[0.2em] ${textSubtitleClass}`}>Experience Gallery</h3>
                    <div className="columns-1 sm:columns-2 gap-6 space-y-6">
                      {event.mediaGallery.map((item, idx) => (
                        <div key={idx} className="relative rounded-[2rem] overflow-hidden glass-card-light group p-1 bg-black/20 break-inside-avoid shadow-lg transition-all hover:shadow-2xl">
                          <div className="w-full h-full rounded-[1.5rem] overflow-hidden relative">
                            {item.type === 'video' ? (
                              <video 
                                className="w-full h-auto object-cover z-10"
                                controls
                                playsInline
                                preload="none"
                                poster={clUrl(item.url.replace('.mp4', '.jpg'))}
                                key={idx}
                              >
                                <source src={clUrl(item.url, 'video')} type="video/mp4" />
                                <source src={item.url} />
                                Your browser does not support the video tag.
                              </video>
                            ) : (
                              <img 
                                src={clUrl(item.url)} 
                                className="w-full h-auto object-cover z-10 transition-transform duration-700 group-hover:scale-[1.03]" 
                                alt={`Gallery item ${idx + 1}`} 
                              />
                            )}
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6 pointer-events-none rounded-[2rem] z-20">
                             <span className="text-[10px] font-black uppercase tracking-widest text-white/90 drop-shadow-md">View {item.type === 'video' ? 'Video' : 'Image'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <BookingModal
          isOpen={isBookingOpen}
          setIsOpen={setIsBookingOpen}
          event={{...event, selectedTier}}
          themeConfig={themeConfig}
        />
      </div>
    </PremiumBackground>
  );
};

export default DefaultlayoutHoc(EventPage);

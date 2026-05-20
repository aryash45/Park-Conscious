/**
 * apps/events/src/components/FeaturedEvents/LandscapeBanner.jsx
 *
 * Purpose: A stunning widescreen landscape banner slider for premium handpicked events.
 * Placed at the very top of the homepage to save vertical space and solve the 3-scroll UX issue.
 * Supports image/banner upload fields, custom floating details, and direct ticketing CTAs.
 */
import React from "react";
import Slider from "react-slick";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Calendar, MapPin, Tag } from "lucide-react";

// Curated aesthetic glow highlights based on accent colors
const accentColors = {
  "red-600":    "bg-red-600/10 shadow-red-600/5",
  "indigo-500": "bg-indigo-500/10 shadow-indigo-500/5",
  "violet-500": "bg-violet-500/10 shadow-violet-500/5",
  "rose-500":   "bg-rose-500/10 shadow-rose-500/5",
  "amber-500":  "bg-amber-500/10 shadow-amber-500/5",
  "emerald-500":"bg-emerald-500/10 shadow-emerald-500/5",
  "sky-500":    "bg-sky-500/10 shadow-sky-500/5",
  "pink-500":   "bg-pink-500/10 shadow-pink-500/5",
  "orange-500": "bg-orange-500/10 shadow-orange-500/5",
  "default":    "bg-indigo-500/10 shadow-indigo-500/5"
};

const textAccentColors = {
  "red-600":    "text-red-400 border-red-500/20",
  "indigo-500": "text-indigo-400 border-indigo-500/20",
  "violet-500": "text-violet-400 border-violet-500/20",
  "rose-500":   "text-rose-400 border-rose-500/20",
  "amber-500":  "text-amber-400 border-amber-500/20",
  "emerald-500":"text-emerald-400 border-emerald-500/20",
  "sky-500":    "text-sky-400 border-sky-500/20",
  "pink-500":   "text-pink-400 border-pink-500/20",
  "orange-500": "text-orange-400 border-orange-500/20",
  "default":    "text-indigo-400 border-indigo-500/20"
};

const LandscapeBanner = ({ featuredEvents, isLoading }) => {
  const navigate = useNavigate();

  const settings = {
    dots: true,
    infinite: featuredEvents && featuredEvents.length > 1,
    speed: 800,
    autoplay: featuredEvents && featuredEvents.length > 1,
    autoplaySpeed: 6000,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: false,
    dotsClass: "slick-dots custom-dots-container",
    appendDots: dots => (
      <div style={{ position: "absolute", bottom: "20px", width: "100%", display: "flex", justifyContent: "center" }}>
        <ul style={{ margin: "0px", padding: "0px", display: "flex", gap: "8px" }}> {dots} </ul>
      </div>
    ),
    customPaging: i => (
      <button className="w-2.5 h-2.5 rounded-full bg-white/20 hover:bg-white/40 transition-all duration-300 custom-dot-btn"></button>
    )
  };

  if (isLoading) {
    return (
      <div className="w-full h-[26rem] md:h-[30rem] lg:h-[34rem] rounded-[2.5rem] bg-slate-900/30 border border-white/5 animate-pulse flex items-center justify-center">
        <div className="text-slate-500 uppercase tracking-widest text-xs">Curating Handpicked Experiences...</div>
      </div>
    );
  }

  // Fallback default featured event if none are in the DB to avoid empty space
  const displayEvents = featuredEvents && featuredEvents.length > 0 ? featuredEvents : [
    {
      _id: "default-featured",
      title: "Backstage Vibe Fest 2026",
      description: "Delhi NCR's definitive lifestyle, music, and food experience. Secure premium parking, dynamic stalls, and live visual performances.",
      category: "Concerts",
      price: 999,
      date: new Date(Date.now() + 86400000 * 5).toISOString(),
      venue: "Kingdom of Dreams, Sector 29",
      accentColor: "indigo-500",
      image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1600&auto=format&fit=crop"
    }
  ];

  return (
    <div className="w-full relative select-none">
      <style>{`
        .custom-dots-container li.slick-active button {
          background: #6366f1 !important;
          width: 24px;
          border-radius: 9999px;
        }
        .custom-dots-container li {
          display: inline-block;
          margin: 0;
        }
      `}</style>
      
      <Slider {...settings}>
        {displayEvents.map((event) => {
          const accent = event.accentColor || "default";
          const glowClass = accentColors[accent] || accentColors["default"];
          const textAccent = textAccentColors[accent] || textAccentColors["default"];
          
          // Image resolution fallbacks: Supports direct landscape banner uploads or default standard images
          const imageUrl = event.bannerImage || (event.images && event.images[0]) || event.image || 'https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=1600&auto=format&fit=crop';

          return (
            <div 
              key={event._id} 
              onClick={() => navigate(`/event/${event._id}`)}
              className="relative w-full h-auto lg:h-[32rem] overflow-hidden focus:outline-none bg-[#0b0b0f] cursor-pointer group rounded-[2.5rem] border border-white/5 hover:border-white/15 transition-all duration-300 shadow-2xl"
            >
              
              <div className="flex flex-col-reverse lg:flex-row w-full h-full">
                
                {/* Left Side Ticket Stub: Dedicated details panel */}
                <div className="w-full lg:w-[32%] p-6 md:p-8 lg:p-10 flex flex-col justify-between border-t border-dashed lg:border-t-0 lg:border-b-0 lg:border-r-2 lg:border-dashed border-white/30 bg-[#08080b] z-10 shrink-0 relative transition-colors duration-300 group-hover:bg-[#0c0c10]">
                  <div className="space-y-5">
                    
                    {/* Category Pill Tag */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                      <span className={`text-[9px] font-black uppercase tracking-[0.25em] ${textAccent}`}>
                        {event.category || "Handpicked"}
                      </span>
                    </div>

                    {/* Title */}
                    <div className="space-y-1">
                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white uppercase tracking-tighter leading-[0.95] drop-shadow-sm group-hover:text-indigo-400 transition-colors duration-300">
                        {event.featuredTitle || event.title}
                      </h1>
                    </div>

                    {/* Host Profile (Dynamic Luma-inspired row) */}
                    {event.hosts && event.hosts.length > 0 && (
                      <div className="flex items-center gap-2 pt-1 border-b border-white/5 pb-2">
                        {event.hosts[0].image ? (
                          <img src={event.hosts[0].image} className="w-5 h-5 rounded-full object-cover border border-white/10" alt="" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[8px] font-black flex items-center justify-center border border-indigo-500/30">H</div>
                        )}
                        <span className="text-[10px] font-bold text-slate-400">
                          Hosted by <span className="text-white font-black">{event.hosts[0].name}</span>
                        </span>
                      </div>
                    )}

                    {/* About Section: High-Density Actual Event Preview (Hidden on mobile to save space) */}
                    <div className="hidden lg:block space-y-1.5 pt-1">
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">About Experience</span>
                      <p className="text-slate-400 text-xs font-medium leading-relaxed line-clamp-3 lg:line-clamp-5">
                        {event.description || event.featuredSubtitle || "Join us for an exclusive curated experience. Detailed information and schedule details will be revealed at the gate."}
                      </p>
                    </div>

                  </div>

                  {/* Info Details & CTA */}
                  <div className="mt-6 pt-5 border-t border-white/10 space-y-4">
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Date */}
                      {event.date && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <Calendar size={13} className="text-indigo-400 shrink-0" />
                          <span className="text-[9px] md:text-xs font-bold tracking-wide uppercase truncate">
                            {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      )}

                      {/* Venue */}
                      {(event.venue || event.location?.name) && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <MapPin size={13} className="text-indigo-400 shrink-0" />
                          <span className="text-[9px] md:text-xs font-bold tracking-wide uppercase truncate">
                            {event.venue || event.location?.name}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-1">
                      {/* Price */}
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Pricing</span>
                        <span className="text-sm font-black text-white">
                          ₹{event.price || "FREE"}
                        </span>
                      </div>

                      {/* Action Button */}
                      <div className="flex items-center gap-2 px-6 py-3 bg-white text-black font-black uppercase tracking-[0.2em] rounded-full text-[9px] group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-md">
                        Get Tickets
                        <ArrowRight size={12} strokeWidth={3} />
                      </div>
                    </div>

                  </div>
                </div>

                {/* Right Side Ticket Stub: Landscape background image (Fully visible and uncropped on mobile) */}
                <div className="w-full lg:w-[68%] h-auto lg:h-full relative overflow-hidden z-0 grow">
                  <img
                    src={imageUrl}
                    alt={event.title}
                    className="w-full h-auto block lg:h-full lg:object-cover opacity-100 transition-transform duration-[4s] ease-out group-hover:scale-[1.03]"
                  />
                  {/* Subtle fade overlay just on the bottom edge on mobile, left edge on desktop to tie them together */}
                  <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-black/20 via-transparent to-transparent pointer-events-none"></div>
                </div>

              </div>
            </div>
          );
        })}
      </Slider>
    </div>
  );
};

export default LandscapeBanner;

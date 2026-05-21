/**
 * apps/events/src/components/FeaturedEvents/FeaturedEventsSection.jsx
 *
 * Purpose: UI component for displaying premium featured events.
 * Renders large, visually engaging cards with dynamic accent colors,
 * hover animations, and direct booking call-to-actions.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Calendar, MapPin } from 'lucide-react';
import { getEventUrlId } from "../../utils/eventUrl";
import { getEventPriceLabel } from "../../utils/eventPrice";

const colorStyles = {
    "red-600":    { border: "group-hover:border-red-600/30",     mesh: "bg-red-600/10",     label: "bg-red-600",     btn: "group-hover:bg-red-600" },
    "indigo-500": { border: "group-hover:border-indigo-500/30",  mesh: "bg-indigo-500/10",  label: "bg-indigo-600",  btn: "group-hover:bg-indigo-600" },
    "violet-500": { border: "group-hover:border-violet-500/30",  mesh: "bg-violet-500/10",  label: "bg-violet-600",  btn: "group-hover:bg-violet-600" },
    "rose-500":   { border: "group-hover:border-rose-500/30",    mesh: "bg-rose-500/10",    label: "bg-rose-600",    btn: "group-hover:bg-rose-600" },
    "amber-500":  { border: "group-hover:border-amber-500/30",   mesh: "bg-amber-500/10",   label: "bg-amber-600",   btn: "group-hover:bg-amber-600" },
    "emerald-500":{ border: "group-hover:border-emerald-500/30", mesh: "bg-emerald-500/10", label: "bg-emerald-600", btn: "group-hover:bg-emerald-600" },
    "sky-500":    { border: "group-hover:border-sky-500/30",     mesh: "bg-sky-500/10",     label: "bg-sky-600",     btn: "group-hover:bg-sky-600" },
    "pink-500":   { border: "group-hover:border-pink-500/30",    mesh: "bg-pink-500/10",    label: "bg-pink-600",    btn: "group-hover:bg-pink-600" },
    "orange-500": { border: "group-hover:border-orange-500/30",  mesh: "bg-orange-500/10",  label: "bg-orange-600",  btn: "group-hover:bg-orange-600" },
    "default":    { border: "group-hover:border-indigo-500/30",  mesh: "bg-indigo-500/10",  label: "bg-indigo-600",  btn: "group-hover:bg-indigo-600" },
};

const SkeletonFeaturedEvent = () => (
  <div className="group relative h-[32rem] rounded-[3rem] overflow-hidden bg-slate-900 border border-white/5 flex items-end p-10 md:p-14 animate-pulse">
    <div className="absolute inset-0 bg-slate-800/20"></div>
    <div className="relative z-20 space-y-6 w-full">
      <div className="flex items-center gap-3">
        <div className="w-24 h-6 bg-slate-800 rounded-full"></div>
        <div className="w-32 h-4 bg-slate-800 rounded"></div>
      </div>
      <div>
        <div className="w-3/4 h-12 md:h-16 bg-slate-800 rounded-xl mb-4"></div>
        <div className="w-1/2 h-4 md:h-5 bg-slate-800 rounded"></div>
      </div>
      <div className="w-40 h-10 bg-slate-800 rounded-full"></div>
    </div>
  </div>
);

const FeaturedEventsSection = ({ featuredEvents, isLoading }) => {
    const navigate = useNavigate();
    
    if (isLoading) {
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
            <SkeletonFeaturedEvent />
            <SkeletonFeaturedEvent />
          </div>
        );
    }

    if (!featuredEvents || featuredEvents.length === 0) return null;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
        {featuredEvents.map((event) => {
          const styles = colorStyles[event.accentColor] || colorStyles["default"];
          const imageUrl = (event.images && event.images[0]) || event.image || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14';
          
          return (
            <div 
              key={event._id}
              onClick={() => navigate(`/event/${getEventUrlId(event)}`)}
              className="group relative h-[34rem] md:h-[38rem] rounded-[2.5rem] overflow-hidden cursor-pointer bg-black border border-white/5 transition-all duration-700 hover:border-white/20"
            >
              {/* Cinematic Background */}
              <div className="absolute inset-0 z-0">
                <img 
                  src={imageUrl} 
                  alt={event.title} 
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-[3s] ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent"></div>
              </div>
              
              {/* Vibrant Accent Glow */}
              <div className={`absolute -bottom-[10%] -left-[10%] w-[70%] h-[70%] blur-[140px] rounded-full transition-opacity duration-1000 opacity-40 group-hover:opacity-60 z-10 ${styles.mesh}`}></div>

              {/* Floating Metadata */}
              <div className="absolute top-8 left-8 right-8 z-20 flex justify-between items-start">
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60 group-hover:text-white transition-colors duration-500">
                    {event.category}
                  </span>
                  <div className="h-[1px] w-8 bg-white/40 group-hover:w-16 transition-all duration-700"></div>
                </div>
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-2 rounded-full shadow-xl">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white">
                    {event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBA'}
                  </p>
                </div>
              </div>

              {/* Content Body */}
              <div className="absolute bottom-0 left-0 w-full p-10 md:p-12 z-20">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h2 className="text-5xl md:text-6xl font-black text-white uppercase tracking-tighter leading-[0.85] transition-transform duration-700 group-hover:-translate-y-2 drop-shadow-lg">
                      {event.featuredTitle || event.title}
                    </h2>
                    <p className="text-white/60 text-[13px] font-medium max-w-sm line-clamp-1 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-700 delay-100">
                      {event.featuredSubtitle || event.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-white/10">
                    <div className="flex items-center gap-4 group/btn">
                      <div className={`w-12 h-12 rounded-full border border-white/20 flex items-center justify-center transition-all duration-500 group-hover:text-white shadow-lg ${styles.btn}`}>
                        <ArrowRight size={20} className="group-hover:rotate-[-45deg] transition-transform duration-500" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/80 group-hover:text-white transition-colors">Experience</span>
                    </div>

                    <div className="flex flex-col items-end">
                       <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white/40 mb-1">Passes</span>
                       <p className="text-3xl font-black text-white tracking-tighter italic drop-shadow-lg">{getEventPriceLabel(event)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
};

export default FeaturedEventsSection;

import React from "react";
import { Link } from "react-router-dom";
import { Calendar, MapPin } from 'lucide-react';
import { preload } from "swr";
import { backendAxios } from "../../axios";

const Poster = (props) => {
  const eventId = props.slug || props._id || props.id;
  
  const prefetchEvent = () => {
    if (eventId) {
      preload(`/api/events?id=${eventId}`, url => backendAxios.get(url).then(res => res.data));
    }
  };

  return (
    <Link 
      to={`/event/${eventId}`} 
      onMouseEnter={prefetchEvent}
      onFocus={prefetchEvent}
      className="group block px-2"
    >
      <div className="relative flex flex-col bg-[#0E0E10] border border-white/5 rounded-[1.5rem] overflow-hidden hover:border-white/15 transition-all duration-500 shadow-xl hover:shadow-indigo-500/5">

        {/* Poster Image */}
        <div className="relative w-full overflow-hidden bg-slate-900" style={{ aspectRatio: '3/4' }}>
          <img
            src={props.poster_path?.startsWith('http') ? props.poster_path : `https://image.tmdb.org/t/p/w500${props.poster_path}`}
            alt={props.original_title}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          />
          {/* Dark gradient fade at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0E0E10] via-[#0E0E10]/20 to-transparent"></div>

          {/* Price badge - top right */}
          <div className="absolute top-3 right-3 z-20">
            <div className="h-6 px-3 rounded-full bg-black/70 backdrop-blur-md border border-white/10 flex items-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-white">
                {props.price ? `₹${props.price}` : 'FREE'}
              </span>
            </div>
          </div>

        </div>

        {/* Content Details */}
        <div className="px-5 py-5 space-y-3">
          {/* Category */}
          <div className="flex items-center gap-2">
            <p className="text-indigo-400 text-[8px] font-black uppercase tracking-[0.3em]">
              {Array.isArray(props.category) ? props.category[0] : props.category || "General Admission"}
            </p>
          </div>

          {/* Title */}
          <h3 className="text-lg font-black text-white uppercase tracking-tighter leading-[0.9]">
            {props.original_title}
          </h3>

          {/* Date & Venue */}
          <div className="pt-3 border-t border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-slate-400">
              <Calendar size={10} className="text-slate-500 shrink-0" />
              <span className="text-[9px] font-bold tracking-wide">
                {props.date ? new Date(props.date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'TBA'}
              </span>
            </div>
            {(props.venue || props.venueCity) && (
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin size={10} className="text-slate-500 shrink-0" />
                <span className="text-[9px] font-bold tracking-wide truncate">
                  {props.venue ? `${props.venue}${props.venueCity ? `, ${props.venueCity}` : ''}` : props.venueCity}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default Poster;

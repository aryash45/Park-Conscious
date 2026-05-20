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

  const titleText = props.original_title || props.title;

  return (
    <Link 
      to={`/event/${eventId}`} 
      onMouseEnter={prefetchEvent}
      onFocus={prefetchEvent}
      className="group block w-full px-0.5 md:px-2"
    >
      <div className="relative flex flex-col bg-[#0E0E10] border border-white/5 rounded-2xl md:rounded-[1.5rem] overflow-hidden hover:border-white/15 transition-all duration-300 shadow-xl hover:shadow-indigo-500/5 items-stretch">

        {/* Poster Thumbnail / Full-bleed Image */}
        <div className="relative w-full aspect-[3/4] overflow-hidden bg-slate-900 m-0">
          <img
            src={props.poster_path?.startsWith('http') ? props.poster_path : `https://image.tmdb.org/t/p/w500${props.poster_path}`}
            alt={titleText}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          />
          {/* Dark gradient fade at bottom (only visible on desktop card view) */}
          <div className="hidden md:block absolute inset-0 bg-gradient-to-t from-[#0E0E10] via-[#0E0E10]/20 to-transparent"></div>

          {/* Price badge - top right */}
          <div className="absolute top-2.5 right-2.5 z-20">
            <div className="h-5 md:h-6 px-2 md:px-3 rounded-full bg-black/75 backdrop-blur-md border border-white/10 flex items-center justify-center">
              <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white">
                {props.price ? `₹${props.price}` : 'FREE'}
              </span>
            </div>
          </div>
        </div>

        {/* Content Details */}
        <div className="p-2 pb-3 md:p-5 flex flex-col justify-between space-y-1.5 md:space-y-3">
          
          <div className="space-y-0.5 md:space-y-1">
            {/* Category / Genre Badge - Desktop Only */}
            <p className="hidden md:block text-indigo-400 text-[8px] font-black uppercase tracking-[0.3em]">
              {Array.isArray(props.category) ? props.category[0] : props.category || "General Admission"}
            </p>
 
            {/* Title - Compact on Mobile, Full on Desktop */}
            <h3 className="text-[9.5px] md:text-lg font-black text-white uppercase tracking-tight md:tracking-tighter leading-tight md:leading-[0.9] truncate md:whitespace-normal md:line-clamp-2">
              {titleText}
            </h3>
          </div>
 
          {/* Date & Venue - Desktop Only */}
          <div className="hidden md:flex pt-3 border-t border-white/5 flex-col space-y-2">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Calendar size={9} className="text-slate-500 shrink-0" />
              <span className="text-[9px] font-bold tracking-wide">
                {props.date ? new Date(props.date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'TBA'}
              </span>
            </div>
            {(props.venue || props.venueCity || props.location) && (
              <div className="flex items-center gap-1.5 text-slate-400">
                <MapPin size={9} className="text-slate-500 shrink-0" />
                <span className="text-[9px] font-bold tracking-wide truncate max-w-none">
                  {props.venue || (typeof props.location === 'object' ? props.location?.name : props.location) || props.venueCity || 'TBA'}
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

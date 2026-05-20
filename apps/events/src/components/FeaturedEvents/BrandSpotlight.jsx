/**
 * apps/events/src/components/FeaturedEvents/BrandSpotlight.jsx
 *
 * Purpose: Curated brand spotlight showcase component (Skillbox Light Theme).
 * Renders a borderless full-width pure white light themed showcase.
 * Standard layout: Flagship vertical poster on the left (38%),
 * details and horizontal sibling editions slider on the right (62%).
 */
import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Calendar, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const BrandSpotlight = ({ spotlight }) => {
  const sliderRef = useRef(null);

  if (!spotlight || !spotlight.isActive || !spotlight.brandPoster) {
    return null;
  }

  const events = spotlight.eventIds || [];
  const firstEvent = events[0] || null;

  const scroll = (direction) => {
    if (sliderRef.current) {
      const { scrollLeft, clientWidth } = sliderRef.current;
      const scrollTo = direction === 'left' 
        ? scrollLeft - clientWidth / 2 
        : scrollLeft + clientWidth / 2;
      sliderRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full bg-[#F5F5F7] text-[#0c0d12] py-20 px-6 md:px-12 border-y border-zinc-200/80 my-24 select-none">
      <div className="container mx-auto max-w-7xl">
        
        {/* Master Flex Row: Left Flagship Vertical Poster, Right Details & Sibling Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-stretch">
          
          {/* Left Column: Big Brand Poster Banner (38% width / 5-cols) */}
          <div className="lg:col-span-5 flex flex-col h-full">
            <div 
              className="w-full h-full min-h-[300px] md:min-h-[500px] lg:min-h-[600px] rounded-[2.5rem] overflow-hidden border border-zinc-200 shadow-2xl relative bg-zinc-100"
            >
              <img 
                src={spotlight.brandPoster} 
                className="w-full h-full object-cover" 
                alt="Brand Spotlight" 
              />
            </div>
          </div>

          {/* Right Column: Details & Carousel Slider (62% width / 7-cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between py-2 space-y-10 lg:space-y-0">
            
            {/* Top Area: Pure Curation Title and Subtitle */}
            <div className="space-y-4">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff385c]">
                #1 in {firstEvent?.category || 'Curated Series'}
              </span>
              
              {/* Title of the brand spotlight */}
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-[#0c0d12] leading-[0.95]">
                {spotlight.title}
              </h2>
              {spotlight.subtitle && (
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest leading-relaxed">
                  {spotlight.subtitle}
                </p>
              )}
            </div>

            {/* Sibling Carousel Area */}
            {events.length > 0 && (
              <div className="space-y-4 pt-8 border-t border-zinc-200/80 relative">
                
                {/* Header and Controls */}
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.25em] block">
                    Curated Editions
                  </span>
                  
                  {/* Slider arrow controls */}
                  {events.length > 3 && (
                    <div className="flex gap-1.5 z-20">
                      <button
                        onClick={() => scroll('left')}
                        className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 hover:text-black transition-all shadow-sm"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => scroll('right')}
                        className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 hover:text-black transition-all shadow-sm"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Horizontal scroll track — cards match Upcoming Events grid exactly */}
                <div 
                  ref={sliderRef}
                  className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-4 px-1"
                >
                  {events.map(event => {
                    const eventId = event.slug || event._id;
                    const posterSrc = (event.images && event.images[0]) || event.image || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14';
                    const venueLabel = event.location?.name || event.venue || '';
                    const cityLabel  = event.location?.city || event.venueCity || '';

                    return (
                      <div key={event._id} className="w-[170px] md:w-[200px] shrink-0">
                        {/* Direct Link to the Event Page */}
                        <Link to={`/event/${eventId}`} className="group block">
                          <div className="relative flex flex-col bg-[#0E0E10] border border-white/5 rounded-[1.5rem] overflow-hidden hover:border-white/15 transition-all duration-500 shadow-xl hover:shadow-indigo-500/5">
                            {/* Poster Image */}
                            <div className="relative w-full overflow-hidden bg-slate-900" style={{ aspectRatio: '3/4' }}>
                              <img
                                src={posterSrc}
                                alt={event.title}
                                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                              />
                              
                              {/* Price badge */}
                              <div className="absolute top-3 right-3 z-20">
                                <div className="h-6 px-3 rounded-full bg-black/70 backdrop-blur-md border border-white/10 flex items-center">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-white">
                                    {event.price ? `₹${event.price}` : 'FREE'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {/* Content Details */}
                            <div className="px-4 py-4 space-y-2">
                              <p className="text-indigo-400 text-[8px] font-black uppercase tracking-[0.3em]">
                                {Array.isArray(event.category) ? event.category[0] : event.category || 'General'}
                              </p>
                              <h3 className="text-sm font-black text-white uppercase tracking-tighter leading-[0.9] truncate">
                                {event.title}
                              </h3>
                              <div className="pt-2 border-t border-white/5 space-y-1.5">
                                <div className="flex items-center gap-1.5 text-slate-400">
                                  <Calendar size={9} className="text-slate-500 shrink-0" />
                                  <span className="text-[8px] font-bold tracking-wide">
                                    {event.date ? new Date(event.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'TBA'}
                                  </span>
                                </div>
                                {(venueLabel || cityLabel) && (
                                  <div className="flex items-center gap-1.5 text-slate-400">
                                    <MapPin size={9} className="text-slate-500 shrink-0" />
                                    <span className="text-[8px] font-bold tracking-wide truncate">
                                      {venueLabel}{cityLabel ? `, ${cityLabel}` : ''}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
          
        </div>

      </div>
    </div>
  );
};

export default BrandSpotlight;

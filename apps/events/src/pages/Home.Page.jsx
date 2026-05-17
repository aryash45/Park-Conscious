/**
 * apps/events/src/pages/Home.Page.jsx
 *
 * Purpose: The main landing page for the public Events platform.
 * Displays featured events, a categorized upcoming events grid, and the discussion board.
 * Includes sophisticated animations and lazy-loaded components for optimal performance.
 */
import React, { useEffect, useState, useMemo, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { backendAxios } from "../axios";
import { Helmet } from "react-helmet";
import { ArrowRight, Calendar, Zap } from 'lucide-react';

// Configuration
import { adCopies, categories, sectionContent } from "../config/home.config";

// HOC
import DefaultlayoutHoc from "../layout/Default.layout";

// Components
import PosterSlider from "../components/PosterSlider/PosterSlider.Component";
import SearchBar from "../components/SearchBar/SearchBar";

const FeaturedEventsSection = lazy(() => import("../components/FeaturedEvents/FeaturedEventsSection"));
const DiscussionBoard = lazy(() => import("../components/Discussion/DiscussionBoard"));

const HomePage = () => {
    const navigate = useNavigate();
    
    // Fetcher for SWR
    const fetcher = url => backendAxios.get(url).then(res => res.data);

    // SWR Data Fetching (Replaces manual localStorage + useEffect)
    const { data: allEventsData, isLoading: isLoadingAll } = useSWR('/api/events', fetcher, {
        revalidateOnFocus: false, // Don't spam API on tab switch
        dedupingInterval: 60000 // Dedupe requests within 1 minute
    });
    
    const { data: featuredData } = useSWR('/api/events?featured=true', fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 60000
    });

    const premierMovies = useMemo(() => {
        if (!allEventsData || allEventsData.missingConfig) return [];
        return allEventsData.map(event => ({
            ...event,
            original_title: event.title || event.name || 'Untitled Event',
            poster_path: (event.images && event.images[0]) || event.image || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14',
        }));
    }, [allEventsData]);

    const featuredEvents = useMemo(() => {
        return Array.isArray(featuredData) ? featuredData : [];
    }, [featuredData]);

    const isInitialLoading = isLoadingAll && !allEventsData?.length;
    
    const [currentAd, setCurrentAd] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState("All Events");
    const [missingConfig, setMissingConfig] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Detect missing config
    useEffect(() => {
        if (allEventsData?.missingConfig) {
            setMissingConfig(true);
        }
    }, [allEventsData]);

    // Ticker Rotation
    useEffect(() => {
      const interval = setInterval(() => {
        setCurrentAd((prev) => (prev + 1) % adCopies.length);
      }, 7000);
      return () => clearInterval(interval);
    }, []);
  
    const filteredEvents = useMemo(() => {
      let events = premierMovies;
      if (selectedCategory !== "All Events") {
        events = events.filter(event => {
          const categoryString = Array.isArray(event.category) 
            ? event.category.join(' ').toLowerCase() 
            : String(event.category || "").toLowerCase();
          return categoryString.includes(selectedCategory.toLowerCase());
        });
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        events = events.filter(event => {
          const title = String(event.title || event.original_title || "").toLowerCase();
          const location = String(
            (typeof event.location === 'object' ? event.location?.name || event.location?.address : event.location) || 
            (typeof event.venue === 'object' ? event.venue?.name : event.venue) || 
            ""
          ).toLowerCase();
          const category = String(event.category || "").toLowerCase();
          const host = String(event.host || event.organizer || event.author || "").toLowerCase();
          
          return title.includes(query) || location.includes(query) || category.includes(query) || host.includes(query);
        });
      }
      return events;
    }, [selectedCategory, premierMovies, searchQuery]);
  
    return (
      <div className="bg-[#050507] min-h-screen text-white pb-24 w-full selection:bg-indigo-500/30">
        <Helmet>
          <title>BACKSTAGE | Curated Events & Seamless Parking</title>
          <meta name="description" content="Discover premium events across Delhi NCR with pre-booked parking included. Authentic experiences powered by Backstage." />
        </Helmet>

        {/* Dynamic Editorial Hero */}
        <div className="w-full relative py-32 md:py-48 flex flex-col items-center overflow-hidden isolation-isolate">
           <svg 
             className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 opacity-50 animate-pulse" 
             style={{ animationDuration: '10s' }}
             viewBox="0 0 1440 600" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"
           >
             <path 
               d="M-50,600 C 150,600 350,550 400,400 C 450,200 200,150 150,350 C 100,550 400,650 700,500 C 1000,350 1300,150 1540,200" 
               stroke="#6366f1" strokeWidth="6" strokeLinecap="round" 
               style={{ filter: 'drop-shadow(0 0 20px rgba(99,102,241,0.5))' }}
             />
           </svg>

           <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full animate-mesh pointer-events-none z-0"></div>
           <div className="absolute bottom-[0%] right-[-5%] w-[40%] h-[60%] bg-blue-600/5 blur-[120px] rounded-full animate-mesh pointer-events-none z-0" style={{ animationDelay: '-5s' }}></div>
           
           <div className="container mx-auto px-6 text-center relative z-10">
              <div className="flex flex-col items-center">
                 <h1 className="text-7xl sm:text-8xl md:text-[10rem] lg:text-[14rem] font-black uppercase tracking-tighter leading-[0.85] md:leading-[0.75] m-0 p-0 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/10 select-none animate-reveal pr-2 md:pr-4" style={{ animationDelay: '0.1s' }}>
                    DON'T MISS
                 </h1>
                 <h1 className="text-7xl sm:text-8xl md:text-[10rem] lg:text-[14rem] font-black uppercase tracking-tighter leading-[0.85] md:leading-[0.75] m-0 p-0 text-transparent bg-clip-text bg-gradient-to-b from-indigo-400 to-indigo-800/20 select-none pb-4 animate-reveal -mt-1 sm:-mt-2 md:-mt-4 pr-2 md:pr-4" style={{ animationDelay: '0.3s' }}>
                    THE VIBE.
                 </h1>
              </div>

              <div className="mt-8 md:mt-12 max-w-xl mx-auto space-y-12 animate-reveal" style={{ animationDelay: '0.6s' }}>
                 <p className="text-slate-400 text-sm md:text-lg font-medium leading-relaxed uppercase tracking-[0.4em]">
                    Curated experiences across Delhi NCR. Pre-booked parking included.
                 </p>
                 <SearchBar 
                    onSearch={(query) => {
                       setSearchQuery(query);
                       document.getElementById('event-grid').scrollIntoView({ behavior: 'smooth' });
                    }} 
                 />
              </div>
           </div>
        </div>
  
        {/* Premium White Glass Ticker */}
        <div className="w-full relative z-20 -mt-8 md:-mt-12">
           <div className="max-w-[1700px] mx-auto px-6">
              <div className="w-full h-14 md:h-16 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl flex items-center justify-center overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                <div 
                  key={currentAd}
                  className="flex items-center gap-6 md:gap-12 px-8 h-full animate-in fade-in slide-in-from-bottom-3 duration-1000"
                >
                    <div className="w-2 h-2 bg-indigo-500 rounded-full shrink-0 animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                    <p className="text-white font-black text-[10px] md:text-[11px] uppercase tracking-[0.4em] text-center drop-shadow-md">
                      {adCopies[currentAd]}
                    </p>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full shrink-0 animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                </div>
              </div>
           </div>
        </div>

        {/* Missing Config Notification */}
        {missingConfig && (
          <div className="container mx-auto px-6 mt-16 relative z-30">
             <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-8 md:p-12 text-center max-w-2xl mx-auto backdrop-blur-md">
                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                   <Zap size={32} className="text-amber-500" />
                </div>
                <h3 className="text-2xl font-black text-amber-500 uppercase tracking-tight mb-4">Connection Required</h3>
                <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                   The frontend is live, but your database is not connected. Add your MONGODB_URI to the .env file.
                </p>
             </div>
          </div>
        )}
  
        {/* Category Navigation */}
        <div className="container mx-auto px-6 mt-32 mb-16 relative z-10 overflow-x-auto no-scrollbar">
          <div className="flex items-center justify-start md:justify-center gap-8 md:gap-12 min-w-max pb-4">
            {categories.map((cat) => (
              <button 
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`relative py-4 text-[11px] font-black uppercase tracking-[0.3em] transition-all duration-300 ${
                  selectedCategory === cat ? "text-white" : "text-slate-500 hover:text-slate-400"
                }`}
              >
                {cat}
                {selectedCategory === cat && (
                   <span className="absolute bottom-0 left-0 w-full h-[2px] bg-white rounded-full animate-in fade-in slide-in-from-left-2 duration-300"></span>
                )}
              </button>
            ))}
          </div>
        </div>
  
        {/* Handpicked Experiences Section */}
        <div className="container mx-auto px-6 md:px-12 mb-16 relative z-10">
           <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
              <div className="space-y-6">
                 <div className="flex items-center gap-3">
                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.4em]">{sectionContent.handpicked.label}</p>
                 </div>
                 <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none">
                    {sectionContent.handpicked.title.split('\n').map((line, i) => (
                      <React.Fragment key={i}>{line}{i === 0 && <br />}</React.Fragment>
                    ))}
                 </h2>
              </div>
              <div className="max-w-xs space-y-4">
                 <p className="text-slate-500 text-sm md:text-base font-medium leading-relaxed">
                    {sectionContent.handpicked.description}
                 </p>
              </div>
           </div>
           <Suspense fallback={<div className="h-96 w-full bg-slate-900/20 rounded-[3rem] animate-pulse"></div>}>
              <FeaturedEventsSection featuredEvents={featuredEvents} isLoading={isInitialLoading} />
           </Suspense>
        </div>
  
        {/* Upcoming Events Grid */}
        <div id="event-grid" className="container mx-auto px-6 md:px-12 mt-12 mb-32 scroll-mt-24">
          <PosterSlider
            title={selectedCategory === "All Events" ? sectionContent.upcoming.title : `FILTERED: ${selectedCategory}`}
            subtitle={selectedCategory === "All Events" ? sectionContent.upcoming.subtitle : `Now viewing curated highlights for ${selectedCategory}`}
            posters={filteredEvents}
            isDark={true}
            isLoading={isInitialLoading}
          />
        </div>

        {/* Discussion Section */}
        <div className="container mx-auto px-6 md:px-12 mt-32">
          <div className="mb-8">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-2">{sectionContent.discussion.label}</p>
             <h3 className="text-4xl font-black uppercase tracking-tighter">{sectionContent.discussion.title}</h3>
          </div>
          <div className="bg-[#111116] border border-white/5 rounded-[3rem] p-8 md:p-14 shadow-3xl min-h-[400px]">
             <Suspense fallback={<div className="w-full h-48 flex items-center justify-center text-slate-500 uppercase tracking-widest text-xs">Loading Discussion...</div>}>
                <DiscussionBoard />
             </Suspense>
          </div>
        </div>
      </div>
    );
  };
  
export default DefaultlayoutHoc(HomePage);

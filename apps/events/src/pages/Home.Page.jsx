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
const LandscapeBanner = lazy(() => import("../components/FeaturedEvents/LandscapeBanner"));
const DiscussionBoard = lazy(() => import("../components/Discussion/DiscussionBoard"));
const BrandSpotlight = lazy(() => import("../components/FeaturedEvents/BrandSpotlight"));

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

    const { data: spotlightData } = useSWR('/api/spotlight', fetcher, {
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

        {/* Tagline Header */}
        <div className="container mx-auto px-6 pt-10 md:pt-12 pb-3 relative z-20">
          <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.35em] text-indigo-400 mb-1.5">
            Curated Experiences
          </p>
          <h1 className="text-xl md:text-3xl font-black text-white tracking-tight uppercase leading-tight max-w-2xl">
            Discover what’s <br className="block md:hidden" /> happening next.
          </h1>
        </div>

        {/* Widescreen Cinematic Landscape Banner for Handpicked Events */}
        <div className="container mx-auto px-6 pt-4 relative z-20">
          <Suspense fallback={<div className="h-[28rem] md:h-[32rem] w-full bg-slate-900/30 rounded-[2.5rem] animate-pulse"></div>}>
            <LandscapeBanner featuredEvents={featuredEvents} isLoading={isInitialLoading} />
          </Suspense>
        </div>

        {/* Missing Config Notification */}
        {missingConfig && (
          <div className="container mx-auto px-6 mt-12 relative z-30">
             <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-8 text-center max-w-2xl mx-auto backdrop-blur-md">
                <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Zap size={24} className="text-amber-500" />
                </div>
                <h3 className="text-xl font-black text-amber-500 uppercase tracking-tight mb-2">Connection Required</h3>
                <p className="text-slate-300 text-xs md:text-sm">
                   The frontend is live, but your database is not connected. Add your MONGODB_URI to the .env file.
                </p>
             </div>
          </div>
        )}
  
        {/* Unified Search + Emoji Scrollable Category Ribbon */}
        <div className="container mx-auto px-6 md:px-12 mt-16 mb-16 relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
           <div className="w-full lg:max-w-md shrink-0">
              <SearchBar 
                 onSearch={(query) => {
                    setSearchQuery(query);
                    document.getElementById('event-grid').scrollIntoView({ behavior: 'smooth' });
                 }} 
              />
           </div>

           <div className="w-full overflow-x-auto no-scrollbar flex items-center gap-4 py-2 px-4 justify-start lg:justify-end">
              {categories.map((cat) => {
                 const isActive = selectedCategory === cat;
                 return (
                   <button 
                     key={cat}
                     onClick={() => setSelectedCategory(cat)}
                     className={`flex items-center gap-2.5 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 shrink-0 border ${
                       isActive 
                         ? "bg-white text-black border-white shadow-xl scale-105" 
                         : "bg-white/5 text-slate-400 hover:text-white border-white/5 hover:bg-white/10"
                     }`}
                   >
                     {cat}
                   </button>
                 );
              })}
           </div>
        </div>
  
        {/* Upcoming Events Grid (Pushed way up for direct visibility) */}
        <div id="event-grid" className="container mx-auto px-6 md:px-12 mt-4 mb-32 scroll-mt-24">
          <PosterSlider
            title={selectedCategory === "All Events" ? sectionContent.upcoming.title : `FILTERED: ${selectedCategory}`}
            subtitle={selectedCategory === "All Events" ? sectionContent.upcoming.subtitle : `Now viewing curated highlights for ${selectedCategory}`}
            posters={filteredEvents}
            isDark={true}
            isLoading={isInitialLoading}
          />
        </div>

        {/* Brand Spotlight Showcase Section (Option A Stark-White contrasts) */}
        {spotlightData && spotlightData.isActive && spotlightData.brandPoster && (
          <Suspense fallback={<div className="container mx-auto px-6 py-20 text-center animate-pulse text-zinc-500 uppercase tracking-widest text-[9px] font-bold">Populating Spotlight Showcase...</div>}>
            <BrandSpotlight spotlight={spotlightData} />
          </Suspense>
        )}

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

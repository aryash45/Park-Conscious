/**
 * apps/events/src/components/Discussion/DiscussionBoard.jsx
 *
 * Purpose: Central component for the community discussion feature.
 * Renders movie prompt cards and discussion posts, handling data fetching
 * and state management for user engagement on the platform.
 */
import React, { useState, useEffect, useCallback } from "react";
import { BiPencil, BiChevronDown, BiPlay } from "react-icons/bi";
import { FiMessageSquare } from "react-icons/fi";
import { useGoogleLogin } from "@react-oauth/google";
import { Link } from "react-router-dom";
import DiscussionPost from "./DiscussionPost";
import NewPostForm from "./NewPostForm";
import { useAuth } from "../../context/DiscussionAuth.context";
import { API_BASE_URL } from "../../config";

// Rotating hook lines to entice user to click/discuss
const HOOK_LINES = [
  "Is this the event of the year? You decide.",
  "Everyone has a take. What's yours?",
  "Worth attending or skip it? Share your verdict.",
  "The internet is split on this one — where do you stand?",
  "Hidden gem or overhyped? Drop your review.",
  "Attendees loved it. Did you? Tell us.",
  "This event broke records. Did it earn it?",
  "First look reactions are in. Time to form your own opinion.",
  "The buzz is real — but is the event?",
  "Would you recommend this to a friend?",
];

// An event discussion "teaser" card shown before any user posts
const EventPromptCard = ({ event, hookLine, onClick }) => {
  const poster = event.image || (event.images && event.images[0]) || null;

  return (
    <button
      onClick={onClick}
      className="group flex gap-3 bg-darkBackground-800 hover:bg-darkBackground-700 border border-darkBackground-700 hover:border-premier-700 rounded-xl p-4 text-left transition-all duration-200 w-full"
    >
      {/* Poster */}
      {poster ? (
        <div className="relative flex-shrink-0 w-14 h-20 rounded-lg overflow-hidden">
          <img src={poster} alt={event.title || event.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <BiPlay className="w-6 h-6 text-white" />
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 w-14 h-20 rounded-lg bg-darkBackground-600 flex items-center justify-center">
          <FiMessageSquare className="w-5 h-5 text-gray-500" />
        </div>
      )}

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="text-premier-700 font-semibold text-sm truncate">
            {event.title || event.name}
          </span>
          {event.date && (
            <span className="text-xs text-gray-600 flex-shrink-0">
              {new Date(event.date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
        </div>
        <p className="text-gray-300 text-sm mt-1 leading-snug">{hookLine}</p>
        <div className="mt-2 flex items-center gap-1 text-xs text-vibrantBlue group-hover:text-premier-700 transition-colors">
          <FiMessageSquare className="w-3 h-3" />
          <span>Start the discussion</span>
        </div>
      </div>
    </button>
  );
};

const DiscussionBoard = () => {
  const { user, signOut, signInWithGoogle } = useAuth();
  const [discussions, setDiscussions] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [loadingDiscussions, setLoadingDiscussions] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [preselectedMovie, setPreselectedMovie] = useState(null);
  const [showAllPrompts, setShowAllPrompts] = useState(false);

  // Fetch upcoming / now-playing events for the prompt cards
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/events`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setNewReleases(data.slice(0, 6));
        }
      })
      .catch(() => {});
  }, []);

  const fetchDiscussions = useCallback(async (p = 1) => {
    setLoadingDiscussions(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/events?action=discussions&page=${p}&limit=6`);
      const data = await res.json();
      if (p === 1) setDiscussions(data.discussions || []);
      else setDiscussions((prev) => [...prev, ...(data.discussions || [])]);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDiscussions(false);
    }
  }, []);

  useEffect(() => {
    fetchDiscussions(1);
  }, [fetchDiscussions]);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        await signInWithGoogle(tokenResponse.access_token);
        window.location.reload();
      } catch (err) {
        console.error("Login failed:", err);
        alert("Login failed: " + err.message);
      }
    },
    flow: "implicit",
  });

  const handlePromptCardClick = (event) => {
    if (!user) return googleLogin();
    setPreselectedMovie(event);
    setShowForm(true);
  };

  const handleVote = async (postId, action) => {
    if (!user) return googleLogin();
    try {
      const res = await fetch(`${API_BASE_URL}/api/events?action=discussions_details&id=${postId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (res.ok) {
        setDiscussions((prev) =>
          prev.map((d) =>
            d._id === postId
              ? { ...d, upvotes: data.upvotes, downvotes: data.downvotes }
              : d
          )
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewPost = (post) => {
    setDiscussions((prev) => [post, ...prev]);
    setPreselectedMovie(null);
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchDiscussions(next);
  };

  return (
    <div>
      {/* ── Section Header ── */}
      <div className="flex flex-col sm:flex-row items-start justify-between mb-10 gap-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Event Discussions</h2>
          <p className="text-gray-400 text-sm mt-1">
            The community's verdict on what's happening near you
          </p>
        </div>

        {user ? (
          <div className="flex items-center gap-3 flex-shrink-0">
            <img
              src={user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`}
              alt={user.name}
              className="w-8 h-8 rounded-full border-2 border-premier-700 object-cover"
              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`; }}
            />
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-premier-700 hover:bg-premier-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              <BiPencil className="w-4 h-4" />
              Post Review
            </button>
            <button
              onClick={signOut}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => googleLogin()}
            className="flex items-center gap-2 bg-darkBackground-800 hover:bg-darkBackground-700 border border-darkBackground-600 hover:border-premier-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex-shrink-0"
          >
            <img
              src="https://in.bmscdn.com/webin/common/icons/googlelogo.svg"
              alt="Google"
              className="w-4 h-4"
              onError={(e) => { e.target.style.display = "none"; }}
            />
            Sign in to discuss
          </button>
        )}
      </div>

      {/* ── New Releases — Event Prompt Cards ── */}
      {newReleases.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-5 rounded-full bg-premier-700" />
            <h3 className="text-white font-semibold">
              New Events — What do you think?
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {newReleases.map((event, i) => {
              const isExtraMobile = i >= 2;
              return (
                <div 
                  key={event._id || event.id}
                  className={isExtraMobile && !showAllPrompts ? "hidden sm:block" : "block"}
                >
                  <EventPromptCard
                    event={event}
                    hookLine={HOOK_LINES[i % HOOK_LINES.length]}
                    onClick={() => handlePromptCardClick(event)}
                  />
                </div>
              );
            })}
          </div>

          {/* Mobile-only Show More / Less toggle button */}
          {newReleases.length > 2 && (
            <div className="block sm:hidden mt-3 text-center">
              <button
                onClick={() => setShowAllPrompts(!showAllPrompts)}
                className="inline-flex items-center gap-1.5 bg-darkBackground-800 hover:bg-darkBackground-700 border border-darkBackground-700 text-gray-300 hover:text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors w-full justify-center"
              >
                <span>{showAllPrompts ? "Show Less" : `Show More (${newReleases.length - 2} More)`}</span>
                <BiChevronDown className={`w-4 h-4 transition-transform duration-300 ${showAllPrompts ? "rotate-180" : ""}`} />
              </button>
            </div>
          )}

          {/* Sign-in CTA shown only to guests */}
          {!user && (
            <div className="mt-4 flex items-center gap-3 bg-premier-900/20 border border-premier-700/30 rounded-xl px-5 py-4">
              <FiMessageSquare className="w-5 h-5 text-premier-700 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-gray-200 text-sm">
                  <strong className="text-white">Join the conversation.</strong> Sign in with Google to share your take on these events.
                </span>
              </div>
              <button
                onClick={() => googleLogin()}
                className="flex-shrink-0 bg-premier-700 hover:bg-premier-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Sign in free
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Divider ── */}
      <div className="flex items-center gap-3 mb-6">
        <span className="w-1 h-5 rounded-full bg-vibrantBlue" />
        <h3 className="text-white font-semibold">Community Reviews</h3>
        <div className="flex-1 h-px bg-darkBackground-700" />
      </div>

      {/* ── Discussion Posts ── */}
      {loadingDiscussions && discussions.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-darkBackground-800 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : discussions.length === 0 ? (
        <div className="text-center py-10 bg-darkBackground-800 rounded-xl border border-dashed border-darkBackground-600">
          <FiMessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No reviews yet</p>
          <p className="text-gray-600 text-sm mt-1">
            Click any event above to kick off the discussion!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {discussions.map((post) => (
            <DiscussionPost key={post._id} post={post} onVote={handleVote} />
          ))}
        </div>
      )}

      {/* ── Load more ── */}
      {page < totalPages && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loadingDiscussions}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors disabled:opacity-50"
          >
            <BiChevronDown className="w-5 h-5" />
            Load more reviews
          </button>
        </div>
      )}

      {/* See all link */}
      <div className="mt-6 text-center">
        <Link
          to="/discussion"
          className="text-xs text-gray-600 hover:text-vibrantBlue transition-colors"
        >
          View all community discussions →
        </Link>
      </div>

      {/* ── New Post Modal ── */}
      {showForm && (
        <NewPostForm
          onClose={() => { setShowForm(false); setPreselectedMovie(null); }}
          onSuccess={handleNewPost}
          preselectedMovie={preselectedMovie}
        />
      )}
    </div>
  );
};

export default DiscussionBoard;

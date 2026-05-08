/**
 * apps/events/src/pages/Discussion.Page.jsx
 *
 * Purpose: Dedicated page for event-specific discussion boards.
 * Allows authenticated users to post comments, reply to threads, and vote
 * on both the main event discussion and individual comments.
 */
import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { BiUpvote, BiDownvote, BiArrowBack } from "react-icons/bi";
import DefaultlayoutHoc from "../layout/Default.layout";
import { useAuth } from "../context/DiscussionAuth.context";
import { useGoogleLogin } from "@react-oauth/google";
import { API_BASE_URL } from "../config";

const StarRating = ({ rating }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <span key={s} className={s <= rating ? "text-accentYellow text-lg" : "text-gray-600 text-lg"}>
        ★
      </span>
    ))}
  </div>
);

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

// Single comment row
const CommentItem = ({ comment, onVote, onReply, currentUser, isReply = false }) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const score = (comment.upvotes?.length || 0) - (comment.downvotes?.length || 0);
  const userUpvoted = currentUser && comment.upvotes?.includes(currentUser.uid);
  const userDownvoted = currentUser && comment.downvotes?.includes(currentUser.uid);

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSubmitting(true);
    await onReply(comment._id, replyText.trim());
    setReplyText("");
    setShowReplyForm(false);
    setSubmitting(false);
  };

  return (
    <div className={`flex gap-3 md:gap-6 py-6 md:py-8 ${isReply ? "ml-4 md:ml-12 border-l border-white/5 pl-4 md:pl-8" : "border-b border-white/5"} last:border-0 group animate-reveal`}>
      <div className="flex flex-col items-center gap-1.5 md:gap-2 min-w-[1.8rem] md:min-w-[2.5rem]">
        <button
          onClick={() => onVote(comment._id, "upvote")}
          className={`p-1.5 md:p-2 rounded-xl transition-all ${userUpvoted ? "bg-indigo-500/10 text-indigo-400" : "text-slate-600 hover:text-white hover:bg-white/5"}`}
        >
          <BiUpvote className="w-4 h-4 md:w-5 md:h-5" />
        </button>
        <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${score > 0 ? "text-indigo-400" : score < 0 ? "text-rose-500" : "text-slate-500"}`}>
          {score}
        </span>
        <button
          onClick={() => onVote(comment._id, "downvote")}
          className={`p-1.5 md:p-2 rounded-xl transition-all ${userDownvoted ? "bg-rose-500/10 text-rose-500" : "text-slate-400 hover:text-rose-500 hover:bg-rose-500/5"}`}
        >
          <BiDownvote className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>
      <div className="flex-1 space-y-3 md:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <img 
              src={comment.authorPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName || 'User')}&background=random`} 
              alt={comment.authorName} 
              className="w-5 h-5 rounded-lg opacity-80 object-cover" 
              onError={(e) => { e.target.src = "https://ui-avatars.com/api/?name=User&background=random"; }}
            />
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white/80">{comment.authorName}</span>
            <span className="hidden md:block w-1 h-1 bg-white/10 rounded-full"></span>
            <span className="text-slate-400 text-[8px] md:text-[9px] font-black uppercase tracking-widest">{formatDate(comment.createdAt)}</span>
          </div>
        </div>
        
        <p className="text-slate-400 text-sm md:text-base leading-relaxed font-medium italic break-words">"{comment.text}"</p>
        
        <div className="flex items-center gap-6">
          {!isReply && currentUser && (
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 hover:text-indigo-400 transition-colors"
            >
              {showReplyForm ? "Cancel Reply" : "Reply"}
            </button>
          )}
        </div>

        {showReplyForm && (
          <form onSubmit={handleReplySubmit} className="mt-4 md:mt-6 space-y-4 animate-reveal">
            <textarea
              className="w-full bg-[#050507] border border-white/5 text-white rounded-2xl px-5 md:px-6 py-3 md:py-4 text-xs md:text-sm resize-none focus:outline-none focus:border-white/20 transition-all font-medium placeholder:text-slate-500 shadow-2xl"
              rows={2}
              placeholder="Write a reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !replyText.trim()}
                className="px-5 md:px-6 py-2 md:py-2.5 text-[8px] md:text-[9px] bg-white text-black font-black rounded-full hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-40 uppercase tracking-[0.3em]"
              >
                {submitting ? "Posting..." : "Post Reply"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const DiscussionPage = () => {
  const { id } = useParams();
  const { user, token, signInWithGoogle } = useAuth();
  const [discussion, setDiscussion] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        await signInWithGoogle(tokenResponse.access_token);
        window.location.reload();
      } catch (err) {
        console.error("Login failed:", err);
      }
    },
    flow: "implicit",
  });

  const fetchData = useCallback(async () => {
    try {
      const [disRes, comRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/discussions/details?id=${id}`),
        fetch(`${API_BASE_URL}/api/discussions/comments?id=${id}`),
      ]);
      
      if (!disRes.ok) {
        if (disRes.status === 404) throw new Error("Discussion not found");
        throw new Error("Failed to load discussion");
      }
      const disData = await disRes.json();
      
      if (!comRes.ok) throw new Error("Failed to load comments");
      const comData = await comRes.json();
      
      setDiscussion(disData.discussion || disData);
      setComments(comData.comments || comData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePostVote = async (action) => {
    if (!user) return googleLogin();
    try {
      const res = await fetch(`${API_BASE_URL}/api/discussions/details?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        setDiscussion((p) => ({ ...p, upvotes: data.upvotes, downvotes: data.downvotes }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCommentVote = async (commentId, action) => {
    if (!user) return googleLogin();
    try {
      const res = await fetch(`${API_BASE_URL}/api/discussions/comments?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ commentId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId ? { ...c, upvotes: data.upvotes, downvotes: data.downvotes } : c
          )
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const submitComment = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!user) return googleLogin();
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/discussions/comments?id=${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: commentText.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [...(Array.isArray(prev) ? prev : []), data]);
        setCommentText("");
        setDiscussion((p) => ({ ...p, commentCount: (p.commentCount || 0) + 1 }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId, text) => {
    if (!user) return googleLogin();
    try {
      const res = await fetch(`${API_BASE_URL}/api/discussions/comments?id=${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, parentId }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [...(Array.isArray(prev) ? prev : []), data]);
        setDiscussion((p) => ({ ...p, commentCount: (p.commentCount || 0) + 1 }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#050507] min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !discussion) {
    return (
      <div className="bg-[#050507] min-h-screen flex flex-col items-center justify-center text-slate-500 gap-8">
        <p className="text-[10px] font-black uppercase tracking-[0.4em]">{error || "Discussion Not Found"}</p>
        <Link to="/" className="px-8 py-3 bg-white text-black font-black uppercase text-[10px] tracking-widest rounded-full hover:bg-indigo-600 hover:text-white transition-all">
          Back To Home
        </Link>
      </div>
    );
  }

  const score = discussion.upvotes.length - discussion.downvotes.length;
  const userUpvoted = user && discussion.upvotes.includes(user.uid);
  const userDownvoted = user && discussion.downvotes.includes(user.uid);

  const safeComments = Array.isArray(comments) ? comments : [];
  const parentComments = safeComments.filter(c => !c.parentId);
  const getReplies = (parentId) => safeComments.filter(c => c.parentId === parentId);

  return (
    <div className="bg-[#050507] min-h-screen pb-32 relative">
      {/* Dynamic Header Glow */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="container mx-auto px-4 md:px-12 py-16 max-w-4xl relative z-10">
        {/* Back */}
        <Link to="/" className="group inline-flex items-center gap-4 text-slate-700 hover:text-white text-[10px] font-black uppercase tracking-[0.4em] mb-16 transition-all">
          <BiArrowBack className="group-hover:-translate-x-2 transition-transform" /> BACK TO HOME
        </Link>

        {/* Discussion Header */}
        <div className="bg-white/5 border border-white/5 rounded-[2.5rem] md:rounded-[3.5rem] p-8 md:p-16 mb-16 backdrop-blur-3xl relative overflow-hidden group shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] -z-10 rounded-full"></div>

          <div className="flex flex-col md:flex-row gap-8 md:gap-10">
            {/* Votes */}
            <div className="flex md:flex-col items-center justify-center gap-2 md:gap-3 bg-white/5 md:bg-transparent rounded-full md:rounded-none px-4 py-2 md:p-0 w-fit md:min-w-[3rem] self-start md:self-auto shadow-xl md:shadow-none border border-white/5 md:border-none">
              <button
                onClick={() => handlePostVote("upvote")}
                className={`p-1.5 md:p-3 rounded-full md:rounded-2xl transition-all ${userUpvoted ? "bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]" : "text-slate-500 hover:text-white hover:bg-white/5"}`}
              >
                <BiUpvote className="w-5 h-5 md:w-8 md:h-8" />
              </button>
              <span className={`text-xs md:text-sm font-black italic tracking-widest px-1 ${score > 0 ? "text-indigo-400" : score < 0 ? "text-rose-500" : "text-slate-500"}`}>
                {score}
              </span>
              <button
                onClick={() => handlePostVote("downvote")}
                className={`p-1.5 md:p-3 rounded-full md:rounded-2xl transition-all ${userDownvoted ? "bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]" : "text-slate-500 hover:text-rose-500 hover:bg-rose-500/5"}`}
              >
                <BiDownvote className="w-5 h-5 md:w-8 md:h-8" />
              </button>
            </div>

            <div className="flex-1 space-y-8">
              <div className="flex items-center gap-6 pb-8 border-b border-white/5">
                {discussion.eventImage && (
                  <img
                    src={discussion.eventImage}
                    alt={discussion.eventTitle}
                    className="w-16 h-24 rounded-2xl object-cover shadow-2xl transition-all duration-700 hover:scale-105"
                  />
                )}
                <div className="space-y-3">
                  <h2 className="text-white font-black text-2xl md:text-4xl uppercase tracking-tighter italic leading-none">{discussion.eventTitle}</h2>
                  <div className="pt-1">
                    <StarRating rating={discussion.rating} />
                  </div>
                </div>
              </div>

              <p className="text-lg md:text-2xl leading-[1.6] font-medium italic opacity-90 break-words">"{discussion.review}"</p>

              <div className="flex items-center gap-6 pt-6 opacity-40">
                {discussion.authorPhoto && (
                  <img src={discussion.authorPhoto} alt={discussion.authorName} className="w-6 h-6 rounded-lg" />
                )}
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white">{discussion.authorName}</span>
                <span className="w-1.5 h-1.5 bg-white/20 rounded-full"></span>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">{formatDate(discussion.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-12">
           <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-500 border-l-4 border-indigo-500 pl-6">
             Community Discussion: {safeComments.length} Comments
           </h3>

           {/* Add Comment Form */}
           <form onSubmit={submitComment} className="space-y-6">
             <textarea
               className="w-full bg-white/5 border border-white/5 text-white rounded-[2.5rem] px-8 py-6 text-base resize-none focus:outline-none focus:border-white/20 transition-all font-medium placeholder:text-slate-400 shadow-2xl"
               rows={4}
               maxLength={2000}
               placeholder={user ? "Join the discussion..." : "Sign in to comment"}
               value={commentText}
               onChange={(e) => setCommentText(e.target.value)}
               onClick={() => !user && googleLogin()}
               readOnly={!user}
             />
             <div className="flex justify-end">
               <button
                 type="submit"
                 disabled={submitting || !commentText.trim()}
                 className="px-10 py-4 text-[11px] bg-white text-black font-black rounded-full hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-40 uppercase tracking-[0.4em] shadow-2xl active:scale-95"
               >
                 {user ? (submitting ? "Posting..." : "Post Comment") : "Sign In to Post"}
               </button>
             </div>
           </form>

           {/* Comments List */}
           <div className="bg-white/5 border border-white/5 rounded-[2.5rem] md:rounded-[3.5rem] px-6 md:px-16 divide-y divide-white/5 shadow-2xl backdrop-blur-3xl">
             {parentComments.length === 0 ? (
               <p className="text-slate-700 text-[10px] font-black uppercase tracking-[0.5em] text-center py-20 italic">
                 No comments yet. Be the first to start the discussion!
               </p>
             ) : (
               parentComments.map((c) => (
                 <React.Fragment key={c._id}>
                   <CommentItem
                     comment={c}
                     onVote={handleCommentVote}
                     onReply={handleReply}
                     currentUser={user}
                   />
                   {getReplies(c._id).map((reply) => (
                     <CommentItem
                       key={reply._id}
                       comment={reply}
                       onVote={handleCommentVote}
                       onReply={handleReply}
                       currentUser={user}
                       isReply={true}
                     />
                   ))}
                 </React.Fragment>
               ))
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default DefaultlayoutHoc(DiscussionPage);

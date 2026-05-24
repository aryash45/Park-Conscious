import React, { useState, useEffect } from "react";
import { BiX } from "react-icons/bi";
import { API_BASE_URL } from "../../config";

const MAX_DISCUSSION_EVENTS = 6;

const StarPicker = ({ value, onChange }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((s) => (
      <button
        key={s}
        type="button"
        onClick={() => onChange(s)}
        className={`text-2xl transition-colors ${s <= value ? "text-accentYellow" : "text-gray-600 hover:text-accentYellow"}`}
      >
        ★
      </button>
    ))}
  </div>
);

const NewPostForm = ({ onClose, onSuccess, preselectedEvent = null }) => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(preselectedEvent);
  const [review, setReview] = useState("");
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/events`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEvents(data.slice(0, MAX_DISCUSSION_EVENTS));
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return setError("Please select an event.");
    if (!rating) return setError("Please give a star rating.");
    if (review.trim().length < 20) return setError("Review must be at least 20 characters.");

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/events?action=discussions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          eventTitle: selectedEvent.title || selectedEvent.name,
          eventId: selectedEvent._id || selectedEvent.id,
          eventImage: selectedEvent.image || (selectedEvent.images && selectedEvent.images[0]) || "",
          review: review.trim(),
          rating,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to post review. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-darkBackground-800 border border-darkBackground-700 rounded-2xl w-full max-w-lg p-6 relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <BiX className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold text-white mb-5">Post an Event Review</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Event picker */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Select Event</label>
            <select
              className="w-full bg-darkBackground-900 border border-darkBackground-600 text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:border-premier-700 text-sm"
              value={selectedEvent?._id || selectedEvent?.id || ""}
              onChange={(e) => {
                const ev = events.find((m) => String(m._id || m.id) === e.target.value);
                setSelectedEvent(ev || null);
              }}
            >
              <option value="">-- Choose an event --</option>
              {events.map((m) => (
                <option key={m._id || m.id} value={m._id || m.id}>
                  {m.title || m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Your Rating</label>
            <StarPicker value={rating} onChange={setRating} />
          </div>

          {/* Review */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Review
              <span className="ml-1 text-gray-600">({review.length}/5000)</span>
            </label>
            <textarea
              className="w-full bg-darkBackground-900 border border-darkBackground-600 text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:border-premier-700 text-sm resize-none"
              rows={5}
              maxLength={5000}
              placeholder="Share your thoughts on this event..."
              value={review}
              onChange={(e) => setReview(e.target.value)}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-darkBackground-600 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm rounded-lg bg-premier-700 text-white font-semibold hover:bg-premier-600 transition-colors disabled:opacity-50"
            >
              {loading ? "Posting..." : "Post Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewPostForm;

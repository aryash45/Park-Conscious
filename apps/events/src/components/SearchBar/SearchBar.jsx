/**
 * apps/events/src/components/SearchBar/SearchBar.jsx
 *
 * Purpose: A premium, glassmorphic search bar with a typing animation.
 * Features: Dynamic placeholder rotation, glassmorphism, and responsive design.
 */
import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

const SearchBar = ({ onSearch }) => {
    const [text, setText] = useState("");
    const [inputValue, setInputValue] = useState("");
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [typingSpeed, setTypingSpeed] = useState(150);

    const placeholders = [
        "Search for 'Lollapalooza'...",
        "Try 'Connaught Place'...",
        "Events in 'Gurgaon' today...",
        "Look for 'Music Festivals'...",
        "Find 'Art Workshops'...",
    ];

    useEffect(() => {
        const handleTyping = () => {
            const fullText = placeholders[placeholderIndex];
            
            if (isDeleting) {
                setText(fullText.substring(0, text.length - 1));
                setTypingSpeed(50);
            } else {
                setText(fullText.substring(0, text.length + 1));
                setTypingSpeed(150);
            }

            if (!isDeleting && text === fullText) {
                setTypingSpeed(2000);
                setIsDeleting(true);
            } else if (isDeleting && text === "") {
                setIsDeleting(false);
                setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
                setTypingSpeed(500);
            }
        };

        if (inputValue === "") {
            const timer = setTimeout(handleTyping, typingSpeed);
            return () => clearTimeout(timer);
        }
    }, [text, isDeleting, placeholderIndex, typingSpeed, inputValue]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (onSearch) onSearch(inputValue);
    };

    return (
        <div className="w-full max-w-3xl mx-auto mt-2 md:mt-6 animate-reveal" style={{ animationDelay: '0.8s' }}>
            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row items-center gap-4 px-4 md:px-0">
                <div className="relative flex-grow w-full group">
                    {/* Glassmorphic Pill */}
                    <div className="relative flex items-center bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-full px-6 py-1 transition-all duration-300 group-focus-within:border-indigo-500/50 group-focus-within:bg-white/[0.08] shadow-2xl">
                        <Search size={18} className="text-indigo-400/60 shrink-0" />
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            autoComplete="off"
                            className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-white placeholder-white/20 px-4 py-3 text-sm md:text-base font-medium tracking-tight"
                            placeholder={inputValue === "" ? text : ""}
                        />
                    </div>
                </div>
                
                <button 
                    type="submit"
                    className="w-full md:w-auto bg-white text-black px-10 py-3.5 rounded-full font-black text-[11px] uppercase tracking-[0.2em] hover:bg-indigo-600 hover:text-white transition-all duration-500 active:scale-95 shadow-2xl whitespace-nowrap"
                >
                    Search
                </button>
            </form>
        </div>
    );
};

export default SearchBar;

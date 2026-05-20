import React from "react";
import Slider from "react-slick";
import Poster from "../Poster/Poster.Component";
import { ChevronRight, ChevronLeft } from "lucide-react";

const NextArrow = (props) => {
  const { className, style, onClick } = props;
  const disabled = className?.includes("slick-disabled");

  return (
    <div
      className={`absolute top-0 bottom-0 right-0 w-12 md:w-32 z-10 flex flex-col justify-center items-end group cursor-pointer bg-gradient-to-l from-[#050507] via-[#050507]/80 to-transparent transition-opacity duration-300 pointer-events-none ${disabled ? 'opacity-0' : 'opacity-100'}`}
      style={{ ...style, display: "flex" }} // Override slick's block display
    >
      <div 
        className="w-8 h-8 md:w-12 md:h-12 mr-1 md:mr-6 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all shadow-xl group-hover:scale-110 pointer-events-auto"
        onClick={onClick}
      >
         <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
      </div>
    </div>
  );
};

const PrevArrow = (props) => {
  const { className, style, onClick } = props;
  const disabled = className?.includes("slick-disabled");

  return (
    <div
       className={`absolute top-0 bottom-0 left-0 w-12 md:w-32 z-10 flex flex-col justify-center items-start group cursor-pointer bg-gradient-to-r from-[#050507] via-[#050507]/80 to-transparent transition-opacity duration-300 pointer-events-none ${disabled ? 'opacity-0' : 'opacity-100'}`}
       style={{ ...style, display: "flex" }} // Override slick's block display
    >
      <div 
        className="w-8 h-8 md:w-12 md:h-12 ml-1 md:ml-6 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all shadow-xl group-hover:scale-110 pointer-events-auto"
        onClick={onClick}
      >
         <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
      </div>
    </div>
  );
};

const PosterSlider = (props) => {
  const { title, subtitle, posters, isDark, isLoading } = props;

  const settings = {
    infinite: false,
    autoplay: false,
    slidesToShow: 5,
    slidesToScroll: 2,
    initialSlide: 0,
    nextArrow: <NextArrow />,
    prevArrow: <PrevArrow />,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 3,
          infinite: true,
          dots: true,
        },
      },
    ],
  };

  return (
    <>
      <div className="flex flex-col items-start sm:ml-3 mb-6 md:mb-10">
        <h3
          className={`text-2xl md:text-5xl font-black uppercase tracking-tighter ${
            isDark ? "text-white" : "text-gray-100"
          }`}
        >
          {title}
        </h3>
        <p className={`text-xs md:text-base font-medium opacity-60 ${isDark ? "text-white" : "text-gray-400"}`}>
          {subtitle}
        </p>
      </div>

      {/* Mobile view: Butter-smooth native CSS horizontal overflow track (Fast, lightweight) */}
      <div className="block md:hidden">
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-4 px-4">
          {isLoading ? (
            [...Array(3)].map((_, index) => (
              <div key={`skeleton-${index}`} className="w-[160px] shrink-0 snap-center">
                <div className="w-full aspect-[3/4] bg-slate-800/80 rounded-2xl animate-pulse"></div>
              </div>
            ))
          ) : posters && posters.length > 0 ? (
            posters.map((each, index) => (
              <div key={index} className="w-[160px] shrink-0 snap-center">
                <Poster {...each} isDark={isDark} />
              </div>
            ))
          ) : (
            <div className="py-10 text-center w-full text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
              No events found.
            </div>
          )}
        </div>
      </div>

      {/* Desktop view: Slick Slider */}
      <div className="hidden md:block">
        <Slider {...settings}>
          {isLoading ? (
            [...Array(5)].map((_, index) => (
               <div key={`skeleton-${index}`} className="px-2">
                   <div className="w-full h-80 bg-slate-800/80 rounded-[3rem] animate-pulse"></div>
                   <div className="w-3/4 h-4 bg-slate-800 rounded-full mt-4 animate-pulse mx-2"></div>
                   <div className="w-1/2 h-3 bg-slate-800 rounded-full mt-2 animate-pulse mx-2"></div>
               </div>
            ))
          ) : posters && posters.length > 0 ? (
            posters.map((each, index) => (
              <Poster {...each} isDark={isDark} key={index} />
            ))
          ) : (
            <div className="py-20 text-center w-full text-slate-500 font-medium border border-dashed border-slate-800 rounded-2xl">
              No events found in this category.
            </div>
          )}
        </Slider>
      </div>
    </>
  );
};

export default PosterSlider;

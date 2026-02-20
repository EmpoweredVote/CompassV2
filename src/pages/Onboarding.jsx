import { useState } from "react";
import { useNavigate } from "react-router";
import { useCompass } from "../components/CompassContext";

// Desktop screenshots
import Welcome_Desktop from "../assets/help/help_1_welcome_desktop.png";
import Calibrate_Desktop from "../assets/help/help_2_calibrate_desktop.png";
import Library_Desktop from "../assets/help/help_3_library_desktop.png";
import Compare_Desktop from "../assets/help/help_4_compare_desktop.png";
import Compass_Desktop from "../assets/help/help_5_compass_desktop.png";

// Mobile screenshots
import Welcome_Mobile from "../assets/help/help_1_welcome_mobile.png";
import Calibrate_Mobile from "../assets/help/help_2_calibrate_mobile.png";
import Library_Mobile from "../assets/help/help_3_library_mobile.png";
import Compare_Mobile from "../assets/help/help_4_compare_mobile.png";
import Compass_Mobile from "../assets/help/help_5_compass_mobile.png";

export function Onboarding() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();
  const { isLoggedIn } = useCompass();

  const totalPages = 5;
  const isLastQuestion = currentIndex == totalPages - 1;
  const pages = Array.from({ length: totalPages }, (_, idx) => idx);

  const pageContent = [
    {
      title: "Welcome to the Empowered Compass!",
      desc: "Visualize your political stance and discover where you stand on key issues. Your compass is personal, interactive, and built by you.",
      desktopSrc: Welcome_Desktop,
      mobileSrc: Welcome_Mobile,
      alt: "Screenshot of the Empowered Compass welcome screen",
    },
    {
      title: "Calibrate Your Compass",
      desc: "A guided flow walks you through picking topics and answering questions. Watch your compass take shape in real time as you share your views.",
      desktopSrc: Calibrate_Desktop,
      mobileSrc: Calibrate_Mobile,
      alt: "Screenshot of the calibration topic picker",
    },
    {
      title: "Explore the Topic Library",
      desc: "Browse all available topics in the Library. Open any topic drawer to read more, adjust your stance, or add it to your compass anytime.",
      desktopSrc: Library_Desktop,
      mobileSrc: Library_Mobile,
      alt: "Screenshot of the Library with a topic drawer open",
    },
    {
      title: "Compare with Candidates",
      desc: "Select any politician to see their stances overlaid on your compass. Instantly see where you align and where you diverge.",
      desktopSrc: Compare_Desktop,
      mobileSrc: Compare_Mobile,
      alt: "Screenshot of the compass compare view with a politician",
    },
    {
      title: "You're ready to begin!",
      desc: "Start the calibration flow and watch your Empowered Compass come to life. It only takes a few minutes to build.",
      desktopSrc: Compass_Desktop,
      mobileSrc: Compass_Mobile,
      alt: "Screenshot of a completed compass",
    },
  ];

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleClose = () => {
    localStorage.setItem("help_seen", "true");
    navigate("/results");
  };

  const handleNext = async () => {
    if (!isLastQuestion) {
      setCurrentIndex((i) => i + 1);
      return;
    }

    localStorage.setItem("help_seen", "true");

    if (isLoggedIn) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/auth/complete-onboarding`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!response.ok) {
          throw new Error("HTTP error " + response.status);
        }
      } catch (err) {
        console.error("Failed to complete onboarding:", err);
      }
    }

    navigate("/results");
  };

  const current = pageContent[currentIndex];

  return (
    <>
      <div className="h-screen flex flex-col gap-2 md:gap-8">
        {/* Close button */}
        <div className="flex justify-end px-4 pt-3 md:px-6 md:pt-4">
          <button
            onClick={handleClose}
            className="p-2 rounded-full text-gray-400 hover:text-black hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-6 h-6"
            >
              <path
                fillRule="evenodd"
                d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Main content area */}
        <main className="flex-1 flex flex-col items-center justify-center md:justify-end px-4">
          <div className="flex flex-col w-full max-w-2xl gap-4">
            {/* Screenshot area — responsive swap via CSS */}
            <div className="w-full flex justify-center mb-4 md:mb-8">
              <div className="w-full max-w-[320px] md:max-w-[600px] lg:max-w-[1000px] aspect-[4/3]">
                {/* Mobile screenshot (hidden on md+) */}
                <img
                  src={current.mobileSrc}
                  alt={current.alt}
                  className="w-full h-full object-contain md:hidden"
                />
                {/* Desktop screenshot (hidden below md) */}
                <img
                  src={current.desktopSrc}
                  alt={current.alt}
                  className="w-full h-full object-contain hidden md:block"
                />
              </div>
            </div>

            {/* Text area */}
            <div className="mt-2 md:mt-4 text-center shrink-0">
              <h1 className="font-bold text-3xl sm:text-3xl md:text-4xl text-[#006678] mb-2">
                {current.title}
              </h1>
              <p className="text-lg md:text-xl font-medium">{current.desc}</p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="h-[12vh] md:h-[10vh] inset-shadow-sm grid grid-cols-3 items-center mx-4 md:mx-8">
          <div className="flex justify-start">
            <button
              onClick={handleBack}
              disabled={currentIndex === 0}
              className={`px-5 py-2 rounded-full border text-sm font-medium transition-colors duration-200
            ${
              currentIndex === 0
                ? "bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed"
                : "bg-white text-black border-black hover:bg-gray-100 cursor-pointer"
            }`}
            >
              Back
            </button>
          </div>

          <div className="flex justify-center">
            <div className="flex gap-2">
              {pages.map((pageIndex) => {
                const isActive = pageIndex === currentIndex;

                return (
                  <div
                    key={pageIndex}
                    className={`h-4 rounded-full bg-blue-600 transition-all duration-300 ease-out
                        ${isActive ? "w-8 opacity-100" : "w-4 opacity-60"}
                        `}
                  ></div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setCurrentIndex(totalPages - 1);
              }}
              className={`px-5 py-2 rounded-full border text-sm font-medium transition-colors duration-200 hidden md:flex
                ${
                  isLastQuestion
                    ? "opacity-0 pointer-events-none"
                    : "cursor-pointer"
                }
                `}
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className={`px-5 py-2 rounded-full border text-sm font-medium transition-colors duration-200 bg-black text-white border-black hover:opacity-90 cursor-pointer`}
            >
              {isLastQuestion ? "Calibrate Your Compass" : "Next"}
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}

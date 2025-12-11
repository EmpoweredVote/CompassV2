// Only redirect to this page the first time a user logs in.
import { useState } from "react";
import { useNavigate } from "react-router";
import Compass from "../assets/compass.jpg";
import OnboardingGif1 from "../assets/onboarding_gifs/onboarding_1.gif";
import OnboardingGif2 from "../assets/onboarding_gifs/onboarding_2.gif";
import OnboardingGif3 from "../assets/onboarding_gifs/onboarding_3.gif";
import OnboardingGif4 from "../assets/onboarding_gifs/onboarding_4.gif";
import OnboardingGif5 from "../assets/onboarding_gifs/onboarding_5.gif";

export function Onboarding() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  const totalPages = 5;
  const isLastQuestion = currentIndex == totalPages - 1;
  const pages = Array.from({ length: totalPages }, (_, idx) => idx);

  const pageContent = [
    {
      title: "Welcome to the Empowered Compass!",
      desc: "Visualize your political stance. Map your alignment on key issues and easily compare your beliefs with leaders.",
      contentSrc: OnboardingGif1,
      alt: "GIF demonstrating the Empowered Compass",
    },
    {
      title: "Choose your Topics",
      desc: "Select up to 8 Topics (e.g. Healthcare, Foreign Policy, etc). These choices build the structure of your personal Compass.",
      contentSrc: OnboardingGif2,
      alt: "GIF showing a user selecting topics",
    },
    {
      title: "Define your Position & Build your Compass",
      desc: "Select a stance on the spectrum. Your choice immediately builds and updates your Compass.",
      contentSrc: OnboardingGif3,
      alt: "GIF showing a user picking their stance",
    },
    {
      title: "Compare with Candidates",
      desc: "Select any politician to see their stances overlayed onto your map. Instantly see where you align and diverge.",
      contentSrc: OnboardingGif4,
      alt: "GIF comparing your compass with a politicians",
    },
    {
      title: "Let's get started!",
      desc: "You're ready to begin! Select your first topics and watch your Empowered Compass build instantly with every stance you choose.",
      contentSrc: OnboardingGif5,
      alt: "Celebration GIF",
    },
  ];

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleNext = () => {
    if (!isLastQuestion) {
      setCurrentIndex((i) => i + 1);
    } else if (isLastQuestion) {
      navigate("/library");
    }
  };

  return (
    <>
      <div className="h-screen flex flex-col gap-2 md:gap-8">
        {/* Main content area */}
        <main className="flex-1 flex flex-col items-center justify-center md:justify-end px-4">
          <div className="flex flex-col w-full max-w-2xl gap-4">
            {/* Image / GIF area */}
            <div className="w-full flex justify-center mb-4 md:mb-8">
              <div className="w-full max-w-[320px] md:max-w-[600px] lg:max-w-[1000px] aspect-[4/3]">
                <img
                  src={pageContent[currentIndex].contentSrc}
                  alt={pageContent[currentIndex].alt}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Text area */}
            <div className="mt-2 md:mt-4 text-center shrink-0">
              <h1 className="font-bold text-3xl sm:text-3xl md:text-4xl text-[#006678] mb-2">
                {pageContent[currentIndex].title}
              </h1>
              <p className="text-lg md:text-xl font-medium">
                {pageContent[currentIndex].desc}
              </p>
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
              onClick={() => navigate("/library")}
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
              {isLastQuestion ? "Done" : "Next"}
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCompass } from "./CompassContext";

function UserDetail() {
  const { topics, answers } = useCompass();

  const topicNames = Object.keys(answers);
  const [dropdownValue, setDropdownValue] = useState("");
  const [sliderValue, setSliderValue] = useState(0); // 1-based
  const [direction, setDirection] = useState(0); // -1 = up, 1 = down

  const handleChange = (e) => {
    const selected = e.target.value;
    setDropdownValue(selected);
    setSliderValue(answers[selected]); // Set to user's stance
  };

  const handleClick = (clickedIndex) => {
    if (clickedIndex + 1 === sliderValue) return; // Already selected
    const dir = clickedIndex + 1 > sliderValue ? 1 : -1;
    setDirection(dir);
    setSliderValue(clickedIndex + 1); // Update to new stance (1-based)
  };

  const stanceVariants = {
    enter: (dir) => ({
      y: dir > 0 ? 100 : -100,
    }),
    center: {
      y: 0,
      transition: { duration: 0.2 },
    },
    exit: (dir) => ({
      y: dir > 0 ? -100 : 100,
      transition: { duration: 0.2 },
    }),
  };

  return (
    <div className="bg-[#FAFAFA] rounded-lg shadow-xl py-4 px-2 w-85 flex flex-col items-center">
      <h2 className="text-xl font-bold mb-4 text-center">
        Your Stance Details
      </h2>

      <select
        value={dropdownValue}
        onChange={handleChange}
        className="w-5/6 font-semibold text-xl mb-6"
      >
        <option value="default">Select a topic...</option>
        {topicNames.map((topic) => (
          <option value={topic} key={topic}>
            {topic}
          </option>
        ))}
      </select>

      {dropdownValue && dropdownValue !== "default" && (
        <div className="text-center flex flex-col gap-4 items-center">
          <div className="relative h-64 w-full overflow-hidden select-none">
            <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-[#FAFAFA] to-transparent z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#FAFAFA] to-transparent z-10 pointer-events-none" />

            {topics
              .filter((t) => t.ShortTitle === dropdownValue)
              .map((topic) => {
                const currentIndex = sliderValue - 1;

                return (
                  <AnimatePresence
                    custom={direction}
                    key={topic.ID}
                    mode="wait"
                  >
                    <motion.div
                      key={sliderValue}
                      custom={direction}
                      variants={stanceVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="cursor-click"
                    >
                      {topic.stances[currentIndex - 1] && (
                        <div
                          className="text-black/25 mb-4 cursor-pointer"
                          onClick={() => handleClick(currentIndex - 1)}
                        >
                          {topic.stances[currentIndex - 1].Text}
                        </div>
                      )}
                      <div className="text-black font-bold mb-4">
                        {topic.stances[currentIndex].Text}
                      </div>
                      {topic.stances[currentIndex + 1] && (
                        <div
                          className="text-black/25 mt-2 cursor-pointer"
                          onClick={() => handleClick(currentIndex + 1)}
                        >
                          {topic.stances[currentIndex + 1].Text}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                );
              })}
          </div>

          <div>
            <h2>{sliderValue}</h2>
            <input
              type="range"
              min={1}
              max={10}
              value={sliderValue}
              onChange={(e) => {
                const newVal = parseInt(e.target.value);
                setDirection(newVal > sliderValue ? 1 : -1);
                setSliderValue(newVal);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDetail;

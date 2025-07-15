import { useState } from "react";
import { useCompass } from "./CompassContext";

function UserDetail({ user }) {
  const { topics, answers, compareAnswers } = useCompass();

  const topicNames = Object.keys(answers);
  const [dropdownValue, setDropdownValue] = useState("");
  const [sliderValue, setSliderValue] = useState(1);

  const handleChange = (e) => {
    const selected = e.target.value;
    setDropdownValue(selected);
    // setSliderValue(answers[selected]); // Default to user's stance
  };

  return (
    <div className="bg-[#FAFAFA] rounded-lg shadow-xl py-4 px-2 w-full flex flex-col items-center">
      <div className="flex flex-col w-5/6 justify-center border-b border-black/40 my-4">
        <select
          value={dropdownValue}
          onChange={handleChange}
          className="w-full font-semibold text-xl mb-2 text-center"
        >
          <option value="default">Select a topic...</option>
          {topicNames.map((topic) => (
            <option value={topic} key={topic}>
              {topic}
            </option>
          ))}
        </select>
      </div>

      {dropdownValue && dropdownValue !== "default" ? (
        <div className="text-center flex flex-col gap-4 items-center">
          {topics
            .filter((t) => t.ShortTitle === dropdownValue)
            .map((topic) => {
              return (
                <div
                  key={topic.ShortTitle}
                  className="w-full flex flex-col gap-4"
                >
                  <div className="w-full flex flex-col border rounded-lg bg-white">
                    <h1 className="font-semibold pt-2">
                      {user.username}'s Stance
                    </h1>
                    <p className="p-3 pb-4">
                      {compareAnswers[dropdownValue] != 0
                        ? topic.stances[compareAnswers[dropdownValue] - 1].Text
                        : `${user.username} has not answered this topic yet.`}
                    </p>
                  </div>

                  <div className="w-full flex flex-col border rounded-lg bg-white">
                    <h1 className="font-semibold pt-2">Your Stance</h1>
                    <p className="p-3 pb-4">
                      {topic.stances[answers[dropdownValue] - 1].Text}
                    </p>
                  </div>

                  <div className="w-full flex flex-col border rounded-lg bg-white">
                    <h1 className="font-semibold pt-2">Explore Stances</h1>
                    <p className="p-3 pb-4">
                      {topic.stances[sliderValue - 1].Text}
                    </p>
                  </div>
                </div>
              );
            })}

          <div className="w-full">
            <h2>{sliderValue}</h2>
            <input
              type="range"
              min={1}
              max={10}
              value={sliderValue}
              onChange={(e) => {
                const newVal = parseInt(e.target.value);
                setSliderValue(newVal);
              }}
              className="w-3/4 accent-purple-400"
            />
          </div>

          <div className="flex w-full justify-evenly my-4">
            {/* <button className="bg-zinc-200 py-2 px-6 rounded-lg">Cancel</button> */}
            <button className="bg-black py-2 px-6 rounded-lg text-white">
              Update Stance
            </button>
          </div>
        </div>
      ) : (
        <div className="p-2 text-center">
          <p>Select a topic to compare your stances with {user.username}'s</p>
        </div>
      )}
    </div>
  );
}

export default UserDetail;

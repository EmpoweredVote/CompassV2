import { useEffect, useState } from "react";
import { useCompass } from "./CompassContext";

function StanceExplorer({ user, dropdownValue, setDropdownValue }) {
  const { topics, setAnswers, answers, compareAnswers } = useCompass();

  const topicNames = Object.keys(answers);
  const [sliderValue, setSliderValue] = useState(1);

  const handleChange = (e) => {
    const selected = e.target.value;
    setDropdownValue(selected);
  };

  const selectedTopic = topics.find((t) => t.ShortTitle === dropdownValue);
  const selectedStanceText =
    selectedTopic && answers[dropdownValue]
      ? selectedTopic.stances[answers[dropdownValue] - 1]?.Text
      : "";

  const updateStance = () => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/answers`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic_id: selectedTopic.ID,
        value: sliderValue - 1,
      }),
    })
      .then((response) => {
        if (response.status === 200) {
          console.log("Stance successfully updated");
          setAnswers((prev) => ({
            ...prev,
            [dropdownValue]: sliderValue,
          }));
        }
      })
      .catch((err) => {
        alert("Error updating your stance. Please try again.");
        console.log(err);
      });
  };

  return (
    <div className="bg-[#FAFAFA] rounded-lg shadow-xl py-4 px-2 w-full flex flex-col items-center">
      <div className="flex flex-col w-5/6 justify-center border-b border-black/40 my-4">
        <select
          value={dropdownValue}
          onChange={handleChange}
          className="w-full font-semibold text-xl mb-2 text-center cursor-pointer"
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
                      {compareAnswers[dropdownValue]
                        ? topic.stances[compareAnswers[dropdownValue] - 1].Text
                        : `${user.username} has not answered this topic yet.`}
                    </p>
                  </div>

                  <div className="w-full flex flex-col border rounded-lg bg-white">
                    <h1 className="font-semibold pt-2">Your Stance</h1>
                    <p className="p-3 pb-4">{selectedStanceText}</p>
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
            <button
              className="bg-black py-2 px-6 rounded-lg text-white"
              onClick={updateStance}
            >
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

export default StanceExplorer;

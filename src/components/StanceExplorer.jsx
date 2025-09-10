import { useEffect, useState } from "react";
import { useCompass } from "./CompassContext";

function StanceExplorer({ politician, dropdownValue, setDropdownValue }) {
  const { topics, setAnswers, answers, compareAnswers } = useCompass();

  const topicNames = Object.keys(answers);
  const [sliderValue, setSliderValue] = useState(1);
  const [maxValue, setMaxValue] = useState();
  const handleChange = (e) => {
    const selected = e.target.value;
    setDropdownValue(selected);
  };

  const fullName = politician.first_name + " " + politician.last_name;

  const selectedTopic = topics.find((t) => t.short_title === dropdownValue);
  const selectedStanceText =
    selectedTopic && answers[dropdownValue]
      ? selectedTopic.stances[answers[dropdownValue] - 1]?.text
      : "";

  const updateStance = () => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/answers`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic_id: selectedTopic.id,
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
    <div className="bg-neutral-50 rounded-lg border border-neutral-200 py-4 px-2 w-full flex flex-col items-center">
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
            .filter((t) => t.short_title === dropdownValue)
            .map((topic) => {
              return (
                <div
                  key={topic.short_title}
                  className="w-full flex flex-col gap-4"
                >
                  <div className="w-full flex flex-col border rounded-lg bg-white">
                    <h1 className="font-semibold pt-2">{fullName}'s Stance</h1>
                    <p className="text-gray-500">
                      {compareAnswers[dropdownValue]}
                    </p>
                    <p className="p-3 pb-4">
                      {compareAnswers[dropdownValue]
                        ? topic.stances[compareAnswers[dropdownValue] - 1].text
                        : `${fullName} has not answered this topic yet.`}
                    </p>
                  </div>

                  <div className="w-full flex flex-col border rounded-lg bg-white">
                    <h1 className="font-semibold pt-2">Your Stance</h1>
                    <p className="text-gray-500">{answers[dropdownValue]}</p>
                    <p className="p-3 pb-4">{selectedStanceText}</p>
                  </div>

                  <div className="w-full flex flex-col border rounded-lg bg-white">
                    <h1 className="font-semibold pt-2">Explore Stances</h1>
                    <p className="p-3 pb-4">
                      {topic.stances[sliderValue - 1].text}
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
              max={selectedTopic.stances.length}
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
          <p>Select a topic to compare your stances with {fullName}'s</p>
        </div>
      )}
    </div>
  );
}

export default StanceExplorer;

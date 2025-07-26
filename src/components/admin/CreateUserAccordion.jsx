function CreateUserAccordion({
  topic,
  isOpen,
  onToggle,
  onCheck,
  checked,
  isAnswered,
}) {
  const answeredIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="size-6 stroke-green-600"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        onClick={onToggle}
        className="bg-gray-100 p-4 cursor-pointer flex justify-between items-center"
      >
        <h2 className="font-semibold text-lg">{topic.short_title}</h2>
        <p>{isAnswered(topic) ? answeredIcon : ""}</p>
      </div>

      {isOpen && (
        <div className="p-4 bg-white">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold">{topic.title}</h2>
              <p className="text-gray-600 italic">{topic.short_title}</p>
            </div>

            <div>
              <h3 className="font-semibold">Stances:</h3>
              {(topic.stances || []).map((stance, index) => (
                <label key={stance.value}>
                  <div className="flex gap-4">
                    <input
                      type="radio"
                      name={topic.short_title}
                      value={stance.value}
                      checked={checked[topic.id]?.answer == stance.value}
                      onChange={() => onCheck(topic, stance.value)}
                    />
                    <p key={index} className="mb-1">
                      {stance.value}. {stance.text}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateUserAccordion;

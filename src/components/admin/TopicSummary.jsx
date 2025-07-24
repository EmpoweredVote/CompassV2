function TopicSummary({ topic, allCategories }) {
  const categoryNames = (topic.Categories || []).map((cat) => {
    const match = allCategories.find((c) => c.ID === cat.ID);
    return match ? match.Title : "Unknown Category";
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">{topic.Title}</h2>
        <p className="text-gray-600 italic">{topic.ShortTitle}</p>
      </div>

      <div>
        <h3 className="font-semibold">Stances:</h3>
        <ul className="list-decimal list-inside ml-4">
          {(topic.stances || []).map((stance, index) => (
            <li key={index} className="mb-1">
              {stance.Text}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-semibold">Categories:</h3>
        <div className="flex flex-wrap gap-2 mt-1">
          {categoryNames.map((name, i) => (
            <span
              key={i}
              className="px-2 py-1 text-sm bg-gray-200 rounded-full"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TopicSummary;

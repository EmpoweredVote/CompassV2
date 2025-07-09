function ContextSummary(ctx) {
  const context = ctx.context;

  if (!context) {
    return;
  }

  return (
    <div className="flex flex-col gap-4 bg-white p-2">
      <div>
        <p className="font-semibold">Reasoning:</p>
        {context.reasoning ? (
          <div className="whitespace-pre-wrap text-base leading-relaxed ml-1">
            {context.reasoning}
          </div>
        ) : (
          <p className="ml-1 italic text-gray-400">No reasoning provided.</p>
        )}
      </div>

      <div>
        <p className="font-semibold">Sources:</p>
        {context.sources?.length ? (
          <ul className="list-disc list-inside ml-1">
            {context.sources.map((src, i) => (
              <li key={i}>{src}</li>
            ))}
          </ul>
        ) : (
          <p className="ml-1 italic text-gray-400">No sources provided.</p>
        )}
      </div>
    </div>
  );
}

export default ContextSummary;

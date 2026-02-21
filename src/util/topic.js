export function getQuestionText(topic) {
  if (!topic) return "";
  return topic.question_text || "";
}

export function parseTensionTitle(topic) {
  if (!topic || !topic.title) {
    return { name: topic?.short_title || "", poles: null };
  }
  const colonIdx = topic.title.indexOf(":");
  if (colonIdx === -1) {
    return { name: topic.short_title || topic.title, poles: null };
  }
  const name = topic.title.slice(0, colonIdx).trim();
  const poles = topic.title.slice(colonIdx + 1).trim();
  return { name, poles: poles || null };
}

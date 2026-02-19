export function getQuestionText(topic) {
  if (!topic) return "";
  return topic.question_text || `Where do you stand on ${topic.short_title}?`;
}

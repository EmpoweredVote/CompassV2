export function getQuestionText(topic) {
  if (!topic) return "";
  return topic.question_text || `What should the government do about ${topic.short_title}?`;
}

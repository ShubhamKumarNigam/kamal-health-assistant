import { languages } from './languages';

export function conversationLanguageInstruction(code) {
  const language = languages.find(item => item.code === code) || languages[0];
  return `Response language: ${language.name} (${language.code}). Write every patient-facing reply and summary in ${language.name}. This explicit selection overrides language guessing. Do not adopt the language of earlier assistant replies, historical summaries, or quoted documents. Keep JSON property names in English. If a different response language is wanted, the patient can use the Reply language selector.`;
}

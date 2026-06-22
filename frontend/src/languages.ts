export const LANGUAGES = [
  { code: "English", label: "English", bcp47: "en-US", flag: "🇺🇸" },
  { code: "Spanish", label: "Spanish", bcp47: "es-ES", flag: "🇪🇸" },
  { code: "French", label: "French", bcp47: "fr-FR", flag: "🇫🇷" },
  { code: "German", label: "German", bcp47: "de-DE", flag: "🇩🇪" },
  { code: "Hindi", label: "Hindi", bcp47: "hi-IN", flag: "🇮🇳" },
  { code: "Mandarin Chinese", label: "Mandarin Chinese", bcp47: "zh-CN", flag: "🇨🇳" },
  { code: "Japanese", label: "Japanese", bcp47: "ja-JP", flag: "🇯🇵" },
  { code: "Korean", label: "Korean", bcp47: "ko-KR", flag: "🇰🇷" },
  { code: "Arabic", label: "Arabic", bcp47: "ar-SA", flag: "🇸🇦" },
  { code: "Portuguese", label: "Portuguese", bcp47: "pt-PT", flag: "🇵🇹" },
  { code: "Russian", label: "Russian", bcp47: "ru-RU", flag: "🇷🇺" },
  { code: "Italian", label: "Italian", bcp47: "it-IT", flag: "🇮🇹" },
  { code: "Bengali", label: "Bengali", bcp47: "bn-IN", flag: "🇧🇩" },
  { code: "Turkish", label: "Turkish", bcp47: "tr-TR", flag: "🇹🇷" },
  { code: "Vietnamese", label: "Vietnamese", bcp47: "vi-VN", flag: "🇻🇳" },
];

export function getFlag(languageCode: string): string {
  if (languageCode === "Auto") return "🌐";
  return LANGUAGES.find((l) => l.code === languageCode)?.flag || "🌐";
}

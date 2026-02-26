const bcp47Map: Record<string, string> = {
  'japanese': 'ja-JP',
  'chinese': 'zh-CN',
  'korean': 'ko-KR',
  'spanish': 'es-ES',
  'french': 'fr-FR',
  'german': 'de-DE',
  'italian': 'it-IT',
  'portuguese': 'pt-BR',
  'russian': 'ru-RU',
  'arabic': 'ar-SA',
  'hindi': 'hi-IN',
  'thai': 'th-TH',
  'vietnamese': 'vi-VN',
  'indonesian': 'id-ID',
  'turkish': 'tr-TR',
  'dutch': 'nl-NL',
  'polish': 'pl-PL',
  'swedish': 'sv-SE',
  'english': 'en-US',
};

export function languageToBCP47(detectedLanguage: string): string {
  const key = detectedLanguage.toLowerCase().trim();
  return bcp47Map[key] || 'en-US';
}

const stopPhrases: Record<string, string[]> = {
  'en': ['stop', 'stop conversation', 'end conversation', 'goodbye', 'bye'],
  'ja': ['ストップ', '終わり', 'おわり', 'やめて', '終了'],
  'zh': ['停止', '结束', '再见', '拜拜'],
  'ko': ['멈춰', '그만', '끝', '종료'],
  'es': ['parar', 'detener', 'adiós', 'terminar'],
  'fr': ['arrêter', 'stop', 'au revoir', 'terminer'],
  'de': ['stopp', 'aufhören', 'tschüss', 'beenden'],
};

export function isStopPhrase(transcript: string, language: string): boolean {
  const normalized = transcript.toLowerCase().trim();
  if (!normalized) return false;

  // Always check English stop phrases
  const englishPhrases = stopPhrases['en'] || [];
  if (englishPhrases.some(phrase => normalized === phrase)) return true;

  // Check target language stop phrases
  const langCode = languageToBCP47(language).split('-')[0];
  const targetPhrases = stopPhrases[langCode] || [];
  return targetPhrases.some(phrase => normalized === phrase);
}

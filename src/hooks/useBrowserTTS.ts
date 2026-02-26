import { useState, useEffect, useRef, useCallback } from 'react';

interface BrowserTTSOptions {
  language?: string;
  rate?: number;
  pitch?: number;
}

export const useBrowserTTS = (options: BrowserTTSOptions = {}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const mountedRef = useRef(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    if (mountedRef.current) {
      setIsPlaying(false);
    }
  }, [isSupported]);

  const speak = useCallback(async (text: string) => {
    if (!isSupported || !text) return;

    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = optionsRef.current.language || 'en-US';
    utterance.rate = optionsRef.current.rate ?? 0.95;
    utterance.pitch = optionsRef.current.pitch ?? 1;

    // Try to pick a voice matching the language
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = utterance.lang.split('-')[0];
    const match = voices.find(v => v.lang.startsWith(langPrefix) && v.localService) ||
                  voices.find(v => v.lang.startsWith(langPrefix));
    if (match) {
      utterance.voice = match;
    }

    utterance.onstart = () => {
      if (mountedRef.current) setIsPlaying(true);
    };

    utterance.onend = () => {
      utteranceRef.current = null;
      if (mountedRef.current) setIsPlaying(false);
    };

    utterance.onerror = (e) => {
      // 'canceled' is normal when we call stop()
      if (e.error !== 'canceled') {
        console.error('Browser TTS error:', e.error);
      }
      utteranceRef.current = null;
      if (mountedRef.current) setIsPlaying(false);
    };

    utteranceRef.current = utterance;
    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  }, [isSupported]);

  // Chrome has a bug where speechSynthesis pauses after ~15s.
  // Keep-alive by pausing/resuming every 10s while speaking.
  useEffect(() => {
    if (!isPlaying || !isSupported) return;

    const interval = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isPlaying, isSupported]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return { speak, stop, isPlaying, isSupported };
};

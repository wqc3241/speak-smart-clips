import { useState, useEffect, useRef, useCallback } from 'react';

interface SpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

const WATCHDOG_INTERVAL_MS = 3000;
const MAX_WATCHDOG_RETRIES = 10;

export const useSpeechRecognition = (options: SpeechRecognitionOptions = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [debugEvents, setDebugEvents] = useState<string[]>([]);
  const isListeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const shouldRestartRef = useRef(false);
  const lastStartAtRef = useRef<number | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Watchdog: detects when SpeechRecognition.start() succeeded but audio
  // capture never began (iOS WebKit bug after TTS playback). Aborts and
  // retries on the same instance, polling every 3 s instead of waiting
  // WebKit's internal 40 s timeout.
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogRetriesRef = useRef(0);
  const audioStartedRef = useRef(false);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const pushDebugEvent = useCallback((label: string, data?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString().split('T')[1]?.replace('Z', '') ?? '';
    const suffix = data ? ` ${JSON.stringify(data)}` : '';
    const line = `[${timestamp}] ${label}${suffix}`;
    setDebugEvents(prev => [...prev.slice(-29), line]);
  }, []);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const createRecognition = useCallback(() => {
    if (!isSupported) return null;

    const SpeechRecognition = (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = options.continuous ?? true;
    recognition.interimResults = options.interimResults ?? true;
    recognition.lang = options.language || 'en-US';

    return recognition;
  }, [isSupported, options.continuous, options.interimResults, options.language]);

  const armWatchdog = useCallback(() => {
    clearWatchdog();
    if (watchdogRetriesRef.current >= MAX_WATCHDOG_RETRIES) {
      pushDebugEvent('watchdog: max retries reached', { retries: watchdogRetriesRef.current });
      return;
    }
    watchdogRef.current = setTimeout(() => {
      watchdogRef.current = null;
      if (!mountedRef.current || !shouldRestartRef.current) return;
      if (audioStartedRef.current) return; // audio is flowing, no action needed

      watchdogRetriesRef.current++;
      pushDebugEvent('watchdog: no audio, abort+retry', { attempt: watchdogRetriesRef.current });

      const rec = recognitionRef.current;
      if (rec) {
        try { rec.abort(); } catch { /* ignore */ }
        // onend will fire → shouldRestart is true → auto-restart + re-arm watchdog
      }
    }, WATCHDOG_INTERVAL_MS);
  }, [clearWatchdog, pushDebugEvent]);

  const stopListening = useCallback((reason: string = 'manual') => {
    pushDebugEvent('stopListening called', { reason, isListening: isListeningRef.current });
    shouldRestartRef.current = false;
    clearWatchdog();
    watchdogRetriesRef.current = 0;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Already stopped
      }
    }
    // Keep recognitionRef.current alive for reuse on iOS
    if (mountedRef.current) {
      setIsListening(false);
    }
  }, [pushDebugEvent, clearWatchdog]);

  const attachHandlers = useCallback((recognition: any) => {
    recognition.onaudiostart = () => {
      audioStartedRef.current = true;
      clearWatchdog();
      watchdogRetriesRef.current = 0;
      pushDebugEvent('onaudiostart');
    };

    recognition.onaudioend = () => {
      audioStartedRef.current = false;
      pushDebugEvent('onaudioend');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      audioStartedRef.current = true;
      clearWatchdog();
      if (!mountedRef.current) return;

      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        pushDebugEvent('onresult final', { finalLength: final.length });
        setFinalTranscript(final);
        setTranscript('');
        optionsRef.current.onResult?.(final, true);
      } else if (interim) {
        setTranscript(interim);
        optionsRef.current.onResult?.(interim, false);
      }
    };

    recognition.onerror = (event: any) => {
      const elapsedMs = lastStartAtRef.current ? Date.now() - lastStartAtRef.current : null;
      pushDebugEvent('onerror', { error: event?.error ?? 'unknown', elapsedMsFromStart: elapsedMs });
      if (!mountedRef.current) return;

      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }

      console.error('Speech recognition error:', event.error);
      optionsRef.current.onError?.(event.error);

      if (event.error === 'not-allowed') {
        shouldRestartRef.current = false;
        clearWatchdog();
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      const elapsedMs = lastStartAtRef.current ? Date.now() - lastStartAtRef.current : null;
      pushDebugEvent('onend', { shouldRestart: shouldRestartRef.current, elapsedMsFromStart: elapsedMs });
      audioStartedRef.current = false;
      if (!mountedRef.current) return;

      if (shouldRestartRef.current) {
        try {
          recognition.start();
          lastStartAtRef.current = Date.now();
          pushDebugEvent('auto-restart start ok');
          armWatchdog();
          return;
        } catch {
          pushDebugEvent('auto-restart failed on same instance');
          try {
            const fresh = createRecognition();
            if (fresh) {
              recognitionRef.current = fresh;
              attachHandlers(fresh);
              fresh.start();
              lastStartAtRef.current = Date.now();
              pushDebugEvent('auto-restart new instance ok');
              armWatchdog();
              return;
            }
          } catch {
            pushDebugEvent('auto-restart failed completely');
          }
        }
      }

      // Don't null recognitionRef — keep instance for reuse on next startListening
      setIsListening(false);
      optionsRef.current.onEnd?.();
    };
  }, [pushDebugEvent, clearWatchdog, armWatchdog, createRecognition]);

  const startListening = useCallback(async (trigger: string = 'unknown') => {
    if (!isSupported) return;
    pushDebugEvent('startListening called', {
      trigger,
      hasRecognition: Boolean(recognitionRef.current),
      shouldRestart: shouldRestartRef.current,
      isListening: isListeningRef.current,
      userActivation: typeof navigator !== 'undefined' && 'userActivation' in navigator
        ? (navigator as any).userActivation?.isActive ?? null
        : null,
      ttsReleasedAgoMs: typeof window !== 'undefined' && (window as any).__audioSessionDebug?.releasedAt
        ? Date.now() - (window as any).__audioSessionDebug.releasedAt
        : null,
      ttsEndedAgoMs: typeof window !== 'undefined' && (window as any).__audioSessionDebug?.endedAt
        ? Date.now() - (window as any).__audioSessionDebug.endedAt
        : null,
    });

    clearWatchdog();
    watchdogRetriesRef.current = 0;
    audioStartedRef.current = false;
    shouldRestartRef.current = true;

    // If currently listening, abort first
    if (recognitionRef.current && isListeningRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      pushDebugEvent('aborted active recognition');
    }

    // Try to REUSE existing instance — on iOS WebKit, reusing the same
    // SpeechRecognition instance avoids the audio-session negotiation that
    // causes the 40 s freeze with new instances after TTS playback.
    if (recognitionRef.current) {
      try {
        attachHandlers(recognitionRef.current);
        recognitionRef.current.start();
        lastStartAtRef.current = Date.now();
        pushDebugEvent('reused recognition.start ok');
        armWatchdog();
        if (mountedRef.current) {
          setIsListening(true);
          setTranscript('');
          setFinalTranscript('');
        }
        return;
      } catch (e) {
        pushDebugEvent('reused recognition.start failed', {
          error: e instanceof Error ? e.message : String(e),
        });
        recognitionRef.current = null;
        // Fall through to create a new instance
      }
    }

    if (!mountedRef.current) return;

    const recognition = createRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;
    attachHandlers(recognition);

    try {
      recognition.start();
      lastStartAtRef.current = Date.now();
      pushDebugEvent('recognition.start ok (new)');
      armWatchdog();
      if (mountedRef.current) {
        setIsListening(true);
        setTranscript('');
        setFinalTranscript('');
      }
    } catch (e) {
      pushDebugEvent('recognition.start threw', {
        error: e instanceof Error ? e.message : String(e),
      });
      console.error('Failed to start speech recognition:', e);
    }
  }, [isSupported, createRecognition, pushDebugEvent, clearWatchdog, armWatchdog, attachHandlers]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setFinalTranscript('');
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      shouldRestartRef.current = false;
      clearWatchdog();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
    };
  }, [clearWatchdog]);

  return {
    isListening,
    isSupported,
    transcript,
    finalTranscript,
    startListening,
    stopListening,
    resetTranscript,
    debugEvents,
  };
};

import { useState, useEffect, useRef, useCallback } from 'react';

interface SpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

// Extend Window for webkit prefix
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export const useSpeechRecognition = (options: SpeechRecognitionOptions = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const shouldRestartRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

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

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
    }
    if (mountedRef.current) {
      setIsListening(false);
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported) return;

    // Detach handlers from old instance BEFORE stopping it. On iOS,
    // .stop() fires onend asynchronously. If the old onend fires after
    // we've created a new instance (with shouldRestartRef = true), it
    // would try to restart the OLD instance — creating two competing
    // recognition instances that both silently fail on iOS.
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }

    // Warm up the microphone — forces iOS to switch the audio session
    // from playback mode back to recording mode after TTS finishes.
    // Without this, recognition.start() succeeds but captures no audio.
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const source = ctx.createMediaStreamSource(stream);
          const gain = ctx.createGain();
          gain.gain.value = 0;          // silent — no feedback
          source.connect(gain);
          gain.connect(ctx.destination); // forces iOS to route mic audio
          await new Promise(r => setTimeout(r, 300));
          source.disconnect();
          await ctx.close().catch(() => {});
        }
        stream.getTracks().forEach(t => t.stop());
      } catch {
        // Permission denied or API unavailable — continue, recognition may still work
      }
    }

    if (!mountedRef.current) return;

    const recognition = createRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    shouldRestartRef.current = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
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
        setFinalTranscript(final);
        setTranscript('');
        optionsRef.current.onResult?.(final, true);
      } else if (interim) {
        setTranscript(interim);
        optionsRef.current.onResult?.(interim, false);
      }
    };

    recognition.onerror = (event: any) => {
      if (!mountedRef.current) return;

      // "no-speech" and "aborted" are normal — don't treat as fatal
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }

      console.error('Speech recognition error:', event.error);
      optionsRef.current.onError?.(event.error);

      if (event.error === 'not-allowed') {
        shouldRestartRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (!mountedRef.current) return;

      // Auto-restart on browser timeout (Chrome stops after ~60s silence)
      if (shouldRestartRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // Failed to restart — create a new instance
          try {
            const newRecognition = createRecognition();
            if (newRecognition) {
              recognitionRef.current = newRecognition;
              newRecognition.onresult = recognition.onresult;
              newRecognition.onerror = recognition.onerror;
              newRecognition.onend = recognition.onend;
              newRecognition.start();
              return;
            }
          } catch {
            // Give up restarting
          }
        }
      }

      setIsListening(false);
      optionsRef.current.onEnd?.();
    };

    try {
      recognition.start();
      if (mountedRef.current) {
        setIsListening(true);
        setTranscript('');
        setFinalTranscript('');
      }
    } catch (e) {
      console.error('Failed to start speech recognition, retrying:', e);
      // iOS may need a moment after audio playback before mic is available.
      // Retry once after a short delay with a fresh instance.
      setTimeout(() => {
        if (!mountedRef.current || !shouldRestartRef.current) return;
        try {
          const retry = createRecognition();
          if (!retry) return;
          recognitionRef.current = retry;
          retry.onresult = recognition.onresult;
          retry.onerror = recognition.onerror;
          retry.onend = recognition.onend;
          retry.start();
          if (mountedRef.current) {
            setIsListening(true);
            setTranscript('');
            setFinalTranscript('');
          }
        } catch (retryErr) {
          console.error('Speech recognition retry also failed:', retryErr);
        }
      }, 500);
    }
  }, [isSupported, createRecognition]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setFinalTranscript('');
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    finalTranscript,
    startListening,
    stopListening,
    resetTranscript,
  };
};

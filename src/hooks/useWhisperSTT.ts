/**
 * Drop-in replacement for useSpeechRecognition on iOS.
 *
 * Uses AudioManager (getUserMedia soft-pause) + OpenAI Whisper API to avoid
 * the iOS WebKit SpeechRecognition 40 s freeze bug.
 *
 * Interface matches useSpeechRecognition so useConversation can swap
 * transparently based on platform detection.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AudioManager } from '@/lib/audioManager';

interface WhisperSTTOptions {
  language?: string;
  /** How long silence must last after speech before auto-stop (default 1500 ms) */
  silenceDurationMs?: number;
  /** How long to wait for any speech before auto-stop (default 8000 ms) */
  noSpeechTimeoutMs?: number;
}

export const useWhisperSTT = (options: WhisperSTTOptions = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [debugEvents, setDebugEvents] = useState<string[]>([]);
  const mountedRef = useRef(true);
  const mgr = useRef(AudioManager.getInstance());
  const transcribingRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const pushDebugEvent = useCallback((label: string, data?: Record<string, unknown>) => {
    const ts = new Date().toISOString().split('T')[1]?.replace('Z', '') ?? '';
    const suffix = data ? ` ${JSON.stringify(data)}` : '';
    setDebugEvents((prev) => [...prev.slice(-29), `[${ts}] ${label}${suffix}`]);
  }, []);

  /** Acquire mic — call from a user-gesture context (e.g. startConversation). */
  const initMic = useCallback(async (): Promise<boolean> => {
    const ok = await mgr.current.init();
    pushDebugEvent(ok ? 'whisper: mic init ok' : 'whisper: mic init failed');
    return ok;
  }, [pushDebugEvent]);

  /** Release all hardware — call when conversation ends. */
  const destroyMic = useCallback(() => {
    mgr.current.destroy();
    pushDebugEvent('whisper: mic destroyed');
  }, [pushDebugEvent]);

  /** Re-acquire mic stream after TTS playback (iOS audio session fix). */
  const refreshMic = useCallback(async () => {
    await mgr.current.refreshStream();
    pushDebugEvent('whisper: mic stream refreshed');
  }, [pushDebugEvent]);

  const stopListening = useCallback(
    (reason: string = 'manual') => {
      pushDebugEvent('whisper: stopListening', { reason });
      if (mgr.current.getState() !== 'recording') {
        setIsListening(false);
        return;
      }

      // Stop capture and send to Whisper
      mgr.current.stopCapture().then(async (blob) => {
        if (!mountedRef.current) return;
        setIsListening(false);

        if (blob.size < 1000) {
          pushDebugEvent('whisper: audio too short, skipping', { bytes: blob.size });
          setTranscript("Didn't catch that — try again");
          setTimeout(() => {
            if (mountedRef.current) setTranscript('');
          }, 2000);
          return;
        }
        if (transcribingRef.current) return;
        transcribingRef.current = true;

        pushDebugEvent('whisper: transcribing', { bytes: blob.size });
        setTranscript('...');

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('Not authenticated');

          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
          const form = new FormData();
          // Whisper needs a recognizable extension
          const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
          form.append('file', blob, `recording.${ext}`);
          if (optionsRef.current.language) {
            form.append('language', optionsRef.current.language);
          }

          const res = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: form,
          });

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText);
          }

          const json = await res.json();
          const text = (json.text as string)?.trim();
          pushDebugEvent('whisper: result', { length: text?.length ?? 0 });

          if (text && mountedRef.current) {
            setTranscript('');
            setFinalTranscript(text);
          } else if (mountedRef.current) {
            // Show brief feedback so user knows to try again
            setTranscript("Didn't catch that — try again");
            setTimeout(() => {
              if (mountedRef.current) setTranscript('');
            }, 2000);
          }
        } catch (e) {
          pushDebugEvent('whisper: transcribe error', {
            error: e instanceof Error ? e.message : String(e),
          });
          setTranscript('');
        } finally {
          transcribingRef.current = false;
        }
      });
    },
    [pushDebugEvent],
  );

  const startListening = useCallback(
    async (trigger: string = 'unknown') => {
      pushDebugEvent('whisper: startListening', { trigger, mgrState: mgr.current.getState() });

      // Ensure mic is initialized
      if (mgr.current.getState() === 'idle') {
        const ok = await mgr.current.init();
        if (!ok) {
          pushDebugEvent('whisper: mic init failed in startListening');
          return;
        }
      }

      setTranscript('');
      setFinalTranscript('');

      const onSilence = () => {
        pushDebugEvent('whisper: silence detected, auto-stop');
        stopListening('silence');
      };

      const captureOpts = {
        silenceDurationMs: optionsRef.current.silenceDurationMs,
        noSpeechTimeoutMs: optionsRef.current.noSpeechTimeoutMs,
      };

      let started = mgr.current.startCapture(onSilence, captureOpts);

      // If startCapture returned false and state fell back to idle,
      // the audio track likely died (OS sleep, backgrounding, etc.).
      // Re-init the mic and retry once.
      if (!started && mgr.current.getState() === 'idle') {
        pushDebugEvent('whisper: track died, re-initing mic');
        const ok = await mgr.current.init();
        if (ok) {
          started = mgr.current.startCapture(onSilence, captureOpts);
        }
      }

      if (started) {
        setIsListening(true);
        pushDebugEvent('whisper: recording started');
      } else {
        pushDebugEvent('whisper: startCapture returned false', { state: mgr.current.getState() });
      }
    },
    [pushDebugEvent, stopListening],
  );

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setFinalTranscript('');
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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
    debugEvents,
    initMic,
    destroyMic,
    refreshMic,
  };
};

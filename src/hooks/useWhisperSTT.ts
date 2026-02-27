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
          pushDebugEvent('whisper: audio too short, skipping');
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
          } else {
            setTranscript('');
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

      const started = mgr.current.startCapture(() => {
        // Silence detected → auto-stop
        pushDebugEvent('whisper: silence detected, auto-stop');
        stopListening('silence');
      });

      if (started) {
        setIsListening(true);
        pushDebugEvent('whisper: recording started');
      } else {
        pushDebugEvent('whisper: startCapture returned false');
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
  };
};

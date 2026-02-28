/**
 * Singleton AudioManager for iOS.
 *
 * On iOS WebKit, repeatedly calling getUserMedia / track.stop() triggers a
 * ~40 s hardware lock in mediaserverd. This manager acquires the mic ONCE
 * and uses track.enabled for soft-pause/resume throughout the conversation.
 *
 * Audio is captured via MediaRecorder and returned as a Blob for Whisper STT.
 */

type AudioManagerState = 'idle' | 'ready' | 'recording';

let _instance: AudioManager | null = null;

class AudioManager {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private state: AudioManagerState = 'idle';
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private analyser: AnalyserNode | null = null;
  private audioCtx: AudioContext | null = null;
  private silenceCheckInterval: ReturnType<typeof setInterval> | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private maxRecordingTimer: ReturnType<typeof setTimeout> | null = null;

  // Callbacks
  private onSilenceDetected: (() => void) | null = null;
  // Configurable silence detection timing
  private silenceDurationMs = 1500;
  private noSpeechTimeoutMs = 8_000;

  static getInstance(): AudioManager {
    if (!_instance) {
      _instance = new AudioManager();
    }
    return _instance;
  }

  getState(): AudioManagerState {
    return this.state;
  }

  /**
   * Acquire mic once at conversation start. Must be called from a user gesture.
   */
  async init(): Promise<boolean> {
    if (this.stream) {
      this.muteStream();
      this.state = 'ready';
      return true;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.muteStream();
      this.state = 'ready';
      return true;
    } catch {
      this.state = 'idle';
      return false;
    }
  }

  /**
   * Force re-acquire the mic stream. On iOS, TTS playback switches the
   * hardware audio session to "playback" mode, causing the existing
   * MediaStream to produce silence. Call this after TTS finishes to
   * ensure the next recording captures real audio.
   */
  async refreshStream(): Promise<void> {
    if (!this.stream) return;
    try {
      // Stop old tracks and re-acquire
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.muteStream();
      console.log('[AudioManager] Stream refreshed after TTS');
    } catch {
      console.warn('[AudioManager] Failed to refresh stream');
    }
  }

  /**
   * Start recording audio. Un-mutes the mic and begins MediaRecorder capture.
   * @param onSilence — called when silence is detected after speech
   * @param opts — optional overrides for silence detection timing
   */
  startCapture(onSilence?: () => void, opts?: { silenceDurationMs?: number; noSpeechTimeoutMs?: number }): boolean {
    if (!this.stream || this.state === 'recording') return false;

    // Check track health — track may have died (OS event, sleep, etc.)
    const track = this.stream.getAudioTracks()[0];
    if (!track || track.readyState === 'ended') {
      this.stream = null;
      this.state = 'idle';
      return false;
    }

    this.onSilenceDetected = onSilence ?? null;
    this.silenceDurationMs = opts?.silenceDurationMs ?? 1500;
    this.noSpeechTimeoutMs = opts?.noSpeechTimeoutMs ?? 8_000;
    this.chunks = [];
    this.unmuteStream();

    // Prefer webm/opus → mp4 → fallback
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(250); // collect in 250 ms chunks
    this.state = 'recording';

    this.setupSilenceDetection();
    return true;
  }

  /**
   * Stop recording and return the audio blob.
   */
  stopCapture(): Promise<Blob> {
    return new Promise((resolve) => {
      this.teardownSilenceDetection();
      this.muteStream();

      if (!this.recorder || this.recorder.state === 'inactive') {
        this.state = 'ready';
        resolve(new Blob(this.chunks, { type: this.chunks[0]?.type || 'audio/webm' }));
        return;
      }

      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.chunks[0]?.type || 'audio/webm' });
        this.chunks = [];
        this.recorder = null;
        this.state = 'ready';
        resolve(blob);
      };
      try {
        this.recorder.stop();
      } catch {
        // recorder.stop() can throw if track ended unexpectedly
        this.recorder = null;
        this.state = 'ready';
        resolve(new Blob(this.chunks, { type: this.chunks[0]?.type || 'audio/webm' }));
      }
    });
  }

  /**
   * Release all hardware resources. Call when conversation ends.
   */
  destroy(): void {
    this.teardownSilenceDetection();
    if (this.recorder && this.recorder.state !== 'inactive') {
      try { this.recorder.stop(); } catch { /* ignore */ }
    }
    this.recorder = null;
    this.chunks = [];

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
    this.state = 'idle';
  }

  // ---- Internal helpers ----

  private muteStream(): void {
    this.stream?.getAudioTracks().forEach((t) => { t.enabled = false; });
  }

  private unmuteStream(): void {
    this.stream?.getAudioTracks().forEach((t) => { t.enabled = true; });
  }

  private setupSilenceDetection(): void {
    if (!this.stream) return;

    // Safety net: max recording duration prevents indefinite mic hold
    // (browser may revoke permission after ~30 s of open mic)
    const MAX_RECORDING_MS = 60_000;
    this.maxRecordingTimer = setTimeout(() => {
      if (this.state === 'recording') {
        this.onSilenceDetected?.();
      }
    }, MAX_RECORDING_MS);

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtx();
      }

      // Disconnect previous source node to prevent leaked audio nodes
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }

      const startAnalysis = () => {
        if (!this.stream || !this.audioCtx || this.state !== 'recording') return;

        this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 512;
        this.sourceNode.connect(this.analyser);

        const buffer = new Uint8Array(this.analyser.frequencyBinCount);
        let speechDetected = false;
        const SILENCE_THRESHOLD = 15; // RMS below this = silence
        const silenceDuration = this.silenceDurationMs;
        const recordingStartedAt = Date.now();
        const noSpeechTimeout = this.noSpeechTimeoutMs;

        this.silenceCheckInterval = setInterval(() => {
          if (!this.analyser) return;
          this.analyser.getByteTimeDomainData(buffer);

          // Compute RMS
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            const v = (buffer[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buffer.length) * 100;

          if (rms > SILENCE_THRESHOLD) {
            speechDetected = true;
            if (this.silenceTimer) {
              clearTimeout(this.silenceTimer);
              this.silenceTimer = null;
            }
          } else if (speechDetected && !this.silenceTimer) {
            this.silenceTimer = setTimeout(() => {
              this.onSilenceDetected?.();
            }, silenceDuration);
          }

          // Fallback: if no speech detected for a long time, the analyser
          // may not be receiving audio data (e.g. AudioContext issue).
          // Auto-stop so the recording still gets processed.
          if (!speechDetected && Date.now() - recordingStartedAt > noSpeechTimeout) {
            this.onSilenceDetected?.();
          }
        }, 100);
      };

      // CRITICAL: On iOS, AudioContext starts suspended and must be
      // resumed before the AnalyserNode can receive audio data.
      // We must wait for resume() to complete before starting analysis,
      // otherwise the analyser reads all zeros and silence detection
      // never triggers — causing the mic to stay open indefinitely.
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().then(startAnalysis).catch(() => {
          // Resume failed — start analysis anyway as best-effort
          startAnalysis();
        });
      } else {
        startAnalysis();
      }
    } catch {
      // Silence detection is best-effort; if it fails, user uses manual stop
    }
  }

  private teardownSilenceDetection(): void {
    if (this.maxRecordingTimer) {
      clearTimeout(this.maxRecordingTimer);
      this.maxRecordingTimer = null;
    }
    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval);
      this.silenceCheckInterval = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    // Disconnect source node to prevent leaked audio nodes
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.analyser = null;
    // Don't close audioCtx here — reuse across recordings
  }
}

export { AudioManager };
export type { AudioManagerState };

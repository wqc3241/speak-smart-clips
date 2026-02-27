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

  // Callbacks
  private onSilenceDetected: (() => void) | null = null;

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
   * Start recording audio. Un-mutes the mic and begins MediaRecorder capture.
   * @param onSilence — called when ~1.5 s of silence is detected after speech
   */
  startCapture(onSilence?: () => void): boolean {
    if (!this.stream || this.state === 'recording') return false;

    this.onSilenceDetected = onSilence ?? null;
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
      this.recorder.stop();
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

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      let speechDetected = false;
      const SILENCE_THRESHOLD = 15; // RMS below this = silence
      const SILENCE_DURATION_MS = 1500;

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
          }, SILENCE_DURATION_MS);
        }
      }, 100);
    } catch {
      // Silence detection is best-effort; if it fails, user uses manual stop
    }
  }

  private teardownSilenceDetection(): void {
    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval);
      this.silenceCheckInterval = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    // Don't close audioCtx here — reuse across recordings
  }
}

export { AudioManager };
export type { AudioManagerState };

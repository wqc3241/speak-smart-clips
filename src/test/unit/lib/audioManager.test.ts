import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock MediaRecorder
class MockMediaRecorder {
  state = 'inactive';
  ondataavailable: ((e: any) => void) | null = null;
  onstop: (() => void) | null = null;
  start = vi.fn(() => { this.state = 'recording'; });
  stop = vi.fn(() => {
    this.state = 'inactive';
    this.onstop?.();
  });
  static isTypeSupported = vi.fn().mockReturnValue(true);
}

// Mock MediaStream
class MockMediaStreamTrack {
  enabled = true;
  stop = vi.fn();
  kind = 'audio';
}

class MockMediaStream {
  private tracks = [new MockMediaStreamTrack()];
  getTracks = () => this.tracks;
  getAudioTracks = () => this.tracks;
}

// Set up globals before importing
const mockGetUserMedia = vi.fn().mockResolvedValue(new MockMediaStream());

Object.defineProperty(globalThis, 'MediaRecorder', { value: MockMediaRecorder, writable: true });
Object.defineProperty(globalThis.navigator, 'mediaDevices', {
  value: { getUserMedia: mockGetUserMedia },
  writable: true,
  configurable: true,
});

describe('AudioManager', () => {
  let AudioManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the singleton by re-importing
    vi.resetModules();
    const mod = await import('@/lib/audioManager');
    AudioManager = mod.AudioManager;
  });

  afterEach(() => {
    // Clean up singleton
    try {
      AudioManager.getInstance().destroy();
    } catch { /* ignore */ }
  });

  it('starts in idle state', () => {
    const mgr = AudioManager.getInstance();
    expect(mgr.getState()).toBe('idle');
  });

  it('init() acquires mic via getUserMedia and transitions to ready', async () => {
    const mgr = AudioManager.getInstance();
    const ok = await mgr.init();

    expect(ok).toBe(true);
    expect(mockGetUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ audio: expect.any(Object) }),
    );
    expect(mgr.getState()).toBe('ready');
  });

  /**
   * REGRESSION: iOS 40s mic freeze — soft-pause pattern
   *
   * On iOS, calling track.stop() and then getUserMedia again triggers a ~40s
   * hardware lock in mediaserverd. The AudioManager must use track.enabled
   * (soft-pause) instead of track.stop() during a conversation.
   *
   * This test verifies:
   * 1. getUserMedia is called only ONCE during init
   * 2. track.stop() is NEVER called during startCapture/stopCapture cycles
   * 3. track.enabled toggles between true/false (soft-pause)
   * 4. track.stop() is only called in destroy() (end of conversation)
   */
  it('never calls track.stop() during recording cycles (iOS soft-pause)', async () => {
    const mgr = AudioManager.getInstance();
    await mgr.init();

    const stream = await mockGetUserMedia.mock.results[0].value as MockMediaStream;
    const track = stream.getAudioTracks()[0] as MockMediaStreamTrack;

    // After init, tracks should be disabled (muted)
    expect(track.enabled).toBe(false);

    // Start recording — track should be enabled
    mgr.startCapture();
    expect(track.enabled).toBe(true);
    expect(track.stop).not.toHaveBeenCalled(); // NEVER stop during conversation

    // Stop recording — track should be disabled again (soft-pause)
    await mgr.stopCapture();
    expect(track.enabled).toBe(false);
    expect(track.stop).not.toHaveBeenCalled(); // Still no stop!

    // Second recording cycle
    mgr.startCapture();
    expect(track.enabled).toBe(true);
    expect(track.stop).not.toHaveBeenCalled();

    await mgr.stopCapture();
    expect(track.enabled).toBe(false);
    expect(track.stop).not.toHaveBeenCalled();

    // getUserMedia should have been called exactly ONCE
    expect(mockGetUserMedia).toHaveBeenCalledTimes(1);

    // Only destroy() should call track.stop()
    mgr.destroy();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('init() is idempotent — second call does not re-acquire mic', async () => {
    const mgr = AudioManager.getInstance();
    await mgr.init();
    await mgr.init();

    expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
  });

  it('startCapture returns false when not ready', () => {
    const mgr = AudioManager.getInstance();
    expect(mgr.startCapture()).toBe(false);
  });

  it('destroy() releases all resources and resets to idle', async () => {
    const mgr = AudioManager.getInstance();
    await mgr.init();
    mgr.destroy();

    expect(mgr.getState()).toBe('idle');
  });

  it('can re-init after destroy', async () => {
    const mgr = AudioManager.getInstance();
    await mgr.init();
    mgr.destroy();
    expect(mgr.getState()).toBe('idle');

    const ok = await mgr.init();
    expect(ok).toBe(true);
    expect(mgr.getState()).toBe('ready');
    expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
  });
});

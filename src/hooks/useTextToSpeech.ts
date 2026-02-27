import { useState, useEffect, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Tiny silent WAV — used to "unlock" audio playback on iOS Safari
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export const useTextToSpeech = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const { toast } = useToast();
    const [currentText, setCurrentText] = useState<string | null>(null);
    const currentObjectUrlRef = useRef<string | null>(null);
    const mountedRef = useRef(true);

    // Persistent Audio element — created once, reused across plays.
    // iOS Safari requires play() from a user gesture; once an element is
    // "unlocked" it stays unlocked for subsequent src changes.
    const audioElRef = useRef<HTMLAudioElement | null>(null);

    const getAudio = () => {
        if (!audioElRef.current) {
            audioElRef.current = new Audio();
        }
        return audioElRef.current;
    };

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            const audio = audioElRef.current;
            if (audio) {
                audio.onended = null;
                audio.onerror = null;
                audio.pause();
                audio.src = '';
                audioElRef.current = null;
            }
            if (currentObjectUrlRef.current) {
                URL.revokeObjectURL(currentObjectUrlRef.current);
                currentObjectUrlRef.current = null;
            }
        };
    }, []);

    /**
     * Call synchronously from a user-gesture handler (click/tap) to unlock
     * audio playback on iOS Safari. Must run before any `await`.
     */
    const prime = () => {
        const audio = getAudio();
        audio.src = SILENT_WAV;
        audio.play().then(() => audio.pause()).catch(() => {});
    };

    const stop = () => {
        const audio = audioElRef.current;
        if (audio) {
            audio.onended = null;
            audio.onerror = null;
            audio.pause();
            // Don't null audioElRef — we reuse the element to keep iOS unlock
        }
        if (currentObjectUrlRef.current) {
            URL.revokeObjectURL(currentObjectUrlRef.current);
            currentObjectUrlRef.current = null;
        }
        if (mountedRef.current) {
            setIsPlaying(false);
            setCurrentText(null);
        }
    };

    const speak = async (text: string, voice: string = 'coral', instructions?: string) => {
        try {
            // If clicking the same button that's playing, stop it
            if (isPlaying && currentText === text) {
                stop();
                return;
            }

            // If different audio is playing, stop it first
            if (isPlaying) {
                stop();
            }

            setIsPlaying(true);
            setCurrentText(text);

            // Get the session for authentication
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                throw new Error('Not authenticated');
            }

            // Get the Supabase URL from environment
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
            if (!supabaseUrl) {
                throw new Error('Missing VITE_SUPABASE_URL');
            }
            const functionUrl = `${supabaseUrl}/functions/v1/generate-speech`;

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    text,
                    voice,
                    ...(instructions && { instructions })
                }),
            });

            if (!mountedRef.current) return;

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to generate speech: ${errorText}`);
            }

            const blob = await response.blob();

            if (!mountedRef.current) return;

            const url = URL.createObjectURL(blob);
            if (currentObjectUrlRef.current) {
                URL.revokeObjectURL(currentObjectUrlRef.current);
            }
            currentObjectUrlRef.current = url;

            // Reuse the persistent audio element (already unlocked on iOS)
            const audio = getAudio();
            audio.onended = null;
            audio.onerror = null;

            audio.onended = () => {
                if (currentObjectUrlRef.current === url) {
                    URL.revokeObjectURL(url);
                    currentObjectUrlRef.current = null;
                }
                // Release the audio resource so iOS frees the audio session
                // for mic input. Null handlers first to prevent onerror firing.
                audio.onended = null;
                audio.onerror = null;
                audio.removeAttribute('src');
                audio.load();
                if (mountedRef.current) {
                    setIsPlaying(false);
                    setCurrentText(null);
                }
            };

            audio.onerror = (e) => {
                console.error('Audio playback error', e);
                if (currentObjectUrlRef.current === url) {
                    URL.revokeObjectURL(url);
                    currentObjectUrlRef.current = null;
                }
                if (mountedRef.current) {
                    setIsPlaying(false);
                    setCurrentText(null);
                    toast({
                        title: "Playback Error",
                        description: "Failed to play the audio.",
                        variant: "destructive",
                    });
                }
            };

            audio.src = url;
            await audio.play();

        } catch (error: unknown) {
            if (!mountedRef.current) return;
            const message = error instanceof Error ? error.message : "Could not generate audio. Please try again.";
            console.error('TTS Error:', error);
            toast({
                title: "Error generating speech",
                description: message,
                variant: "destructive",
            });
            setIsPlaying(false);
            setCurrentText(null);
        }
    };

    return { speak, stop, prime, isPlaying, currentText };
};

import { useState, useEffect, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useTextToSpeech = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const { toast } = useToast();
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);
    const [currentText, setCurrentText] = useState<string | null>(null);
    const currentObjectUrlRef = useRef<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (currentAudioRef.current) {
                currentAudioRef.current.pause();
                currentAudioRef.current.src = '';
            }
            if (currentObjectUrlRef.current) {
                URL.revokeObjectURL(currentObjectUrlRef.current);
                currentObjectUrlRef.current = null;
            }
        };
    }, []);

    const speak = async (text: string, voice: string = 'coral', instructions?: string) => {
        try {
            // If clicking the same button that's playing, stop it
            if (isPlaying && currentAudioRef.current && currentText === text) {
                currentAudioRef.current.pause();
                setIsPlaying(false);
                setCurrentText(null);
                return;
            }

            // If different audio is playing, stop it first
            if (isPlaying && currentAudioRef.current) {
                currentAudioRef.current.pause();
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
            const audio = new Audio(url);

            audio.onended = () => {
                if (currentObjectUrlRef.current === url) {
                    URL.revokeObjectURL(url);
                    currentObjectUrlRef.current = null;
                }
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

            currentAudioRef.current = audio;
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

    return { speak, isPlaying, currentText };
};

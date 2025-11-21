import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useTextToSpeech = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const { toast } = useToast();
    const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
    const [currentText, setCurrentText] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.src = '';
            }
        };
    }, [currentAudio]);

    const speak = async (text: string, voice: string = 'coral', instructions?: string) => {
        try {
            // If clicking the same button that's playing, stop it
            if (isPlaying && currentAudio && currentText === text) {
                currentAudio.pause();
                setIsPlaying(false);
                setCurrentText(null);
                return;
            }

            // If different audio is playing, stop it first
            if (isPlaying && currentAudio) {
                currentAudio.pause();
            }

            setIsPlaying(true);
            setCurrentText(text);

            // Get the session for authentication
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                throw new Error('Not authenticated');
            }

            // Get the Supabase URL from environment
            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-speech`;

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

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to generate speech: ${errorText}`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);

            audio.onended = () => {
                setIsPlaying(false);
                setCurrentText(null);
                URL.revokeObjectURL(url);
            };

            audio.onerror = (e) => {
                console.error('Audio playback error', e);
                setIsPlaying(false);
                setCurrentText(null);
                toast({
                    title: "Playback Error",
                    description: "Failed to play the audio.",
                    variant: "destructive",
                });
            };

            setCurrentAudio(audio);
            await audio.play();

        } catch (error: any) {
            console.error('TTS Error:', error);
            toast({
                title: "Error generating speech",
                description: error.message || "Could not generate audio. Please try again.",
                variant: "destructive",
            });
            setIsPlaying(false);
            setCurrentText(null);
        }
    };

    return { speak, isPlaying, currentText };
};

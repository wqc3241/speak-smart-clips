import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useTextToSpeech = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const { toast } = useToast();
    const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

    useEffect(() => {
        return () => {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.src = '';
            }
        };
    }, [currentAudio]);

    const speak = async (text: string, voice: string = 'coral') => {
        try {
            if (isPlaying && currentAudio) {
                currentAudio.pause();
                setIsPlaying(false);
                return;
            }

            setIsPlaying(true);

            // Get the session for authentication
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                throw new Error('Not authenticated');
            }

            // Get the Supabase URL from the client
            const supabaseUrl = supabase.supabaseUrl;
            const functionUrl = `${supabaseUrl}/functions/v1/generate-speech`;

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ text, voice }),
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
                URL.revokeObjectURL(url);
            };

            audio.onerror = (e) => {
                console.error('Audio playback error', e);
                setIsPlaying(false);
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
        }
    };

    return { speak, isPlaying };
};

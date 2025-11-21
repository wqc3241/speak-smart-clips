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

            const { data, error } = await supabase.functions.invoke('generate-speech', {
                body: { text, voice },
                responseType: 'blob',
            });

            if (error) {
                throw new Error(error.message || 'Failed to generate speech');
            }

            if (!(data instanceof Blob)) {
                throw new Error('Invalid response format');
            }

            const url = URL.createObjectURL(data);
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

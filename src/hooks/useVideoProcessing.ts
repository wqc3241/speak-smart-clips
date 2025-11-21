import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { YoutubeTranscript } from 'youtube-transcript';
import { useToast } from "@/hooks/use-toast";

export const useVideoProcessing = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState<string>('');
    const { toast } = useToast();

    const extractVideoId = (url: string) => {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
        return match ? match[1] : null;
    };

    const fetchAvailableLanguages = async (videoId: string) => {
        try {
            console.log('Fetching available languages for:', videoId);
            const { data, error } = await supabase.functions.invoke('get-available-languages', {
                body: { videoId }
            });

            if (error || !data?.success) {
                console.warn('Could not fetch languages, proceeding with auto-detection');
                return null;
            }

            return data.availableLanguages || [];
        } catch (error) {
            console.error('Error fetching languages:', error);
            return null;
        }
    };

    const fetchTranscript = async (videoId: string, languageCode?: string) => {
        // 1) Try server-side extract-transcript first (most reliable)
        try {
            console.log('Trying extract-transcript edge function for:', videoId, 'language:', languageCode || 'auto');
            const { data, error } = await supabase.functions.invoke('extract-transcript', {
                body: { videoId, languageCode }
            });
            
            // Check for rate limit error specifically
            if (data?.error && data.error.includes('Rate limit exceeded')) {
                throw new Error('RATE_LIMIT_EXCEEDED');
            }
            
            if (!error && data?.success && data.transcript) {
                console.log('✓ Successfully extracted transcript via extract-transcript');
                return {
                    transcript: data.transcript,
                    videoTitle: data.videoTitle || `Video Lesson - ${videoId}`,
                    captionsAvailable: data.captionsAvailable || false,
                };
            }

            // If transcript is too short, throw immediately with user-friendly message
            if (data?.error && data.error.includes('more than 50 words')) {
                throw new Error(data.error);
            }

            console.warn('extract-transcript failed or returned no transcript:', data?.error);
        } catch (err) {
            // Re-throw rate limit errors to be handled by processVideo
            if (err instanceof Error && err.message === 'RATE_LIMIT_EXCEEDED') {
                throw err;
            }
            console.warn('extract-transcript edge function failed:', err);
        }

        // 2) Last resort: Try client-side transcript (limited by CORS)
        try {
            console.log('Trying client-side youtube-transcript for:', videoId);
            let segments: any[] | null = null;
            try {
                segments = await (YoutubeTranscript as any).fetchTranscript(videoId, { lang: 'en' });
            } catch (e) {
                // Fallback to any available language
                segments = await (YoutubeTranscript as any).fetchTranscript(videoId);
            }

            if (segments && segments.length) {
                const transcript = segments.map((s: any) => s.text).join(' ');
                let videoTitle = `Video Lesson - ${videoId}`;
                try {
                    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
                    if (res.ok) {
                        const meta = await res.json();
                        if (meta.title) videoTitle = meta.title;
                    }
                } catch (e) {
                    console.warn('Title fetch failed, using default.', e);
                }
                console.log('✓ Successfully extracted transcript via client-side youtube-transcript');
                return { transcript, videoTitle, captionsAvailable: true };
            }
        } catch (err) {
            console.warn('youtube-transcript failed:', err);
        }

        console.error('All transcript extraction methods failed for video:', videoId);
        throw new Error('Could not extract transcript. Please ensure the video has captions available and try again.');
    };

    const analyzeContentWithAI = async (script: string) => {
        try {
            console.log('Analyzing content with AI...');

            const { data, error } = await supabase.functions.invoke('analyze-content', {
                body: { transcript: script }
            });

            if (error) {
                console.error('AI analysis error:', error);
                throw error;
            }

            console.log('AI analysis result:', data);

            return {
                vocabulary: data.vocabulary || [],
                grammar: data.grammar || [],
                detectedLanguage: data.detectedLanguage || 'Unknown'
            };
        } catch (error) {
            console.error('Failed to analyze content with AI:', error);
            // Return empty arrays if AI analysis fails
            return {
                vocabulary: [],
                grammar: [],
                detectedLanguage: 'Unknown'
            };
        }
    };

    const generatePracticeSentences = async (vocabulary: any[], grammar: any[], detectedLanguage: string) => {
        try {
            console.log('Generating practice sentences...');

            const { data, error } = await supabase.functions.invoke('generate-practice-sentences', {
                body: {
                    vocabulary,
                    grammar,
                    detectedLanguage,
                    count: 10
                }
            });

            if (error) {
                console.error('Error generating sentences:', error);
                return [];
            }

            if (data?.sentences && data.sentences.length > 0) {
                console.log('Generated practice sentences:', data.sentences.length);
                return data.sentences;
            }

            return [];
        } catch (error: any) {
            console.error('Failed to generate sentences:', error);
            return [];
        }
    };

    const processVideo = async (videoId: string, languageCode?: string, selectedLanguageName?: string) => {
        setIsProcessing(true);
        setProcessingStep('Extracting transcript...');

        try {
            const { transcript, videoTitle } = await fetchTranscript(videoId, languageCode);

            setProcessingStep('Analyzing content with AI...');
            const { vocabulary, grammar, detectedLanguage: aiDetectedLang } = await analyzeContentWithAI(transcript);

            // Use selected language if available, otherwise use AI detected language
            const finalLanguage = selectedLanguageName || aiDetectedLang;

            setProcessingStep('Generating practice sentences...');
            const practiceSentences = await generatePracticeSentences(vocabulary, grammar, finalLanguage);

            const project = {
                id: Date.now(),
                title: videoTitle || `Video Lesson - ${videoId}`,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                script: transcript,
                vocabulary,
                grammar,
                detectedLanguage: finalLanguage,
                practiceSentences
            };

            toast({
                title: "Video processed successfully!",
                description: `Your lesson is ready for study. Language: ${finalLanguage}`,
            });

            return project;
        } catch (error: any) {
            // Check for rate limit error
            if (error.message === 'RATE_LIMIT_EXCEEDED') {
                toast({
                    title: "Rate Limit Exceeded",
                    description: "The transcript service is temporarily rate limited. Please wait a few minutes and try again.",
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Processing failed",
                    description: error.message || "Failed to process video",
                    variant: "destructive",
                });
            }
            throw error;
        } finally {
            setIsProcessing(false);
            setProcessingStep('');
        }
    };

    const regenerateAnalysis = async (currentProject: any) => {
        if (!currentProject) return null;

        setIsProcessing(true);
        setProcessingStep('Re-analyzing content with AI...');

        try {
            console.log('Regenerating analysis with language:', currentProject.detectedLanguage);

            // Re-analyze content with the current detected language
            const { vocabulary, grammar, detectedLanguage } = await analyzeContentWithAI(currentProject.script);

            setProcessingStep('Generating practice sentences...');

            // Regenerate practice sentences
            const practiceSentences = await generatePracticeSentences(vocabulary, grammar, detectedLanguage);

            setProcessingStep('');

            toast({
                title: "Analysis regenerated!",
                description: `Content re-analyzed as ${detectedLanguage}`,
            });

            return {
                ...currentProject,
                vocabulary,
                grammar,
                detectedLanguage,
                practiceSentences
            };

        } catch (error: any) {
            console.error('Failed to regenerate analysis:', error);
            toast({
                title: "Regeneration failed",
                description: error.message || "Could not regenerate analysis",
                variant: "destructive",
            });
            return null;
        } finally {
            setIsProcessing(false);
            setProcessingStep('');
        }
    };

    return {
        isProcessing,
        processingStep,
        setProcessingStep,
        setIsProcessing,
        extractVideoId,
        fetchAvailableLanguages,
        processVideo,
        regenerateAnalysis,
        analyzeContentWithAI,
        generatePracticeSentences
    };
};

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { AppProject, GrammarItem, PracticeSentence, VocabularyItem } from '@/types/project';

export const useVideoProcessing = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState<string>('');
    const { toast } = useToast();
    const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const mountedRef = useRef(true);

    const cleanup = useCallback(() => {
        pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
        pollingIntervalsRef.current.clear();
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            cleanup();
        };
    }, [cleanup]);

    const extractVideoId = (url: string) => {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
        return match ? match[1] : null;
    };

    const fetchAvailableLanguages = async (videoId: string) => {
        try {
            const { data, error } = await supabase.functions.invoke('get-available-languages', {
                body: { videoId }
            });

            if (error || !data?.success) {
                return null;
            }

            return data.availableLanguages || [];
        } catch (error) {
            console.error('Error fetching languages:', error);
            return null;
        }
    };

    const fetchTranscript = async (videoId: string, languageCode?: string) => {
        try {
            const { data, error } = await supabase.functions.invoke('extract-transcript', {
                body: { videoId, languageCode }
            });

            // Check for pending status (202 with jobId)
            if (data?.status === 'pending' && data?.jobId) {
                return {
                    status: 'pending',
                    jobId: data.jobId,
                    videoTitle: `Video Lesson - ${videoId}`,
                };
            }

            // Check for rate limit error specifically
            if (data?.error && data.error.includes('Rate limit exceeded')) {
                throw new Error('RATE_LIMIT_EXCEEDED');
            }

            if (!error && data?.success && data.transcript) {
                return {
                    status: 'completed',
                    transcript: data.transcript,
                    videoTitle: data.videoTitle || `Video Lesson - ${videoId}`,
                    captionsAvailable: data.captionsAvailable || false,
                };
            }

            // If transcript is too short, throw immediately with user-friendly message
            if (data?.error && data.error.includes('more than 50 words')) {
                throw new Error(data.error);
            }
        } catch (err) {
            // Re-throw rate limit errors to be handled by processVideo
            if (err instanceof Error && err.message === 'RATE_LIMIT_EXCEEDED') {
                throw err;
            }
            // Re-throw transcript too short errors
            if (err instanceof Error && err.message.includes('more than 50 words')) {
                throw err;
            }
        }

        console.error('Transcript extraction failed for video:', videoId);
        throw new Error('Could not extract transcript. Please ensure the video has captions available and try again.');
    };

    const analyzeContentWithAI = async (script: string) => {
        try {
            const { data, error } = await supabase.functions.invoke('analyze-content', {
                body: { transcript: script }
            });

            if (error) {
                console.error('AI analysis error:', error);
                throw error;
            }

            // Check for rate limit or credit errors in the response
            if (data.error) {
                toast({
                    title: "AI Analysis Issue",
                    description: data.error,
                    variant: "destructive"
                });
            }

            return {
                vocabulary: data.vocabulary || [],
                grammar: data.grammar || [],
                detectedLanguage: data.detectedLanguage || 'Unknown'
            };
        } catch (error) {
            console.error('Failed to analyze content with AI:', error);
            toast({
                title: "Analysis failed",
                description: "Could not analyze content. Please try again.",
                variant: "destructive"
            });
            return {
                vocabulary: [],
                grammar: [],
                detectedLanguage: 'Unknown'
            };
        }
    };

    const generatePracticeSentences = async (
        vocabulary: VocabularyItem[],
        grammar: GrammarItem[],
        detectedLanguage: string
    ): Promise<PracticeSentence[]> => {
        try {
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
                return data.sentences;
            }

            return [];
        } catch (error: unknown) {
            console.error('Failed to generate sentences:', error);
            return [];
        }
    };

    const startJobPolling = (
        jobId: string,
        videoId: string,
        initialProject: AppProject,
        onComplete: (project: AppProject) => void
    ) => {
        const pollInterval = setInterval(async () => {
            if (!mountedRef.current) return;
            try {
                const { data, error } = await supabase.functions.invoke('poll-transcript-job', {
                    body: { jobId, videoId }
                });

                if (error) {
                    console.error('Polling error:', error);
                    return;
                }

                if (!mountedRef.current) return;

                if (data.status === 'completed') {
                    clearInterval(pollInterval);
                    pollingIntervalsRef.current.delete(jobId);

                    // Complete the processing
                    await completeProjectProcessing(initialProject, data.transcript, data.videoTitle, onComplete);
                } else if (data.status === 'failed') {
                    clearInterval(pollInterval);
                    pollingIntervalsRef.current.delete(jobId);

                    // Update project status to failed
                    await updateProjectToFailed(jobId, data.error, initialProject?.userId);
                    if (mountedRef.current) {
                        toast({
                            title: "Generation failed",
                            description: data.error,
                            variant: "destructive"
                        });
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 60000); // 60 seconds

        pollingIntervalsRef.current.set(jobId, pollInterval);
    };

    const completeProjectProcessing = async (
        initialProject: AppProject,
        transcript: string,
        videoTitle: string,
        onComplete: (project: AppProject) => void
    ) => {
        try {
            // Analyze content
            const { vocabulary, grammar, detectedLanguage } = await analyzeContentWithAI(transcript);

            // Generate practice sentences
            const practiceSentences = await generatePracticeSentences(vocabulary, grammar, detectedLanguage);

            const completedProject = {
                ...initialProject,
                title: videoTitle,
                script: transcript,
                vocabulary,
                grammar,
                detectedLanguage,
                practiceSentences,
                status: 'completed',
                jobId: undefined,
                errorMessage: undefined
            };

            // Update in database
            const { error: updateError } = await supabase
                .from('projects')
                .update({
                    title: videoTitle,
                    script: transcript,
                    vocabulary,
                    grammar,
                    practice_sentences: practiceSentences as unknown as import('@/integrations/supabase/types').Json,
                    detected_language: detectedLanguage,
                    vocabulary_count: vocabulary.length,
                    grammar_count: grammar.length,
                    status: 'completed',
                    job_id: null,
                    error_message: null,
                    updated_at: new Date().toISOString()
                })
                .eq('job_id', initialProject.jobId)
                .eq('user_id', initialProject.userId);

            if (updateError) {
                throw updateError;
            }

            if (mountedRef.current) {
                toast({
                    title: "Video ready!",
                    description: `"${videoTitle}" is now ready for study.`
                });

                onComplete(completedProject as AppProject);
            }
        } catch (error) {
            console.error('Failed to complete project processing:', error);
        }
    };

    const updateProjectToFailed = async (jobId: string, errorMessage: string, userId?: string) => {
        try {
            let query = supabase
                .from('projects')
                .update({
                    status: 'failed',
                    error_message: errorMessage,
                    updated_at: new Date().toISOString()
                })
                .eq('job_id', jobId);

            if (userId) {
                query = query.eq('user_id', userId);
            }

            const { error } = await query;

            if (error) {
                throw error;
            }
        } catch (error) {
            console.error('Failed to update project status:', error);
        }
    };

    const processVideo = async (
        videoId: string,
        userId?: string,
        onProjectUpdate?: (project: AppProject) => void
    ): Promise<AppProject> => {
        if (mountedRef.current) {
            setIsProcessing(true);
            setProcessingStep('Extracting transcript...');
        }

        try {
            // Try to find native-language captions for better script fidelity
            let preferredLanguageCode: string | undefined;
            try {
                const languages = await fetchAvailableLanguages(videoId);
                if (languages && languages.length > 0) {
                    // Prefer manual non-English captions, then any non-English captions
                    const manualNonEnglish = languages.find(
                        (l: { code: string; type: string }) => l.type !== 'auto-generated' && l.code !== 'en'
                    );
                    const anyNonEnglish = languages.find(
                        (l: { code: string }) => l.code !== 'en'
                    );
                    preferredLanguageCode = (manualNonEnglish || anyNonEnglish)?.code;
                }
            } catch {
                // Silently fall back to auto mode
            }

            const result = await fetchTranscript(videoId, preferredLanguageCode);

            // Handle pending status (AI generation)
            if (result.status === 'pending' && result.jobId) {
                const pendingProject = {
                    id: Date.now(),
                    title: result.videoTitle,
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    script: '',
                    vocabulary: [],
                    grammar: [],
                    detectedLanguage: 'Detecting...',
                    practiceSentences: [],
                    status: 'pending' as const,
                    jobId: result.jobId,
                    userId
                };

                toast({
                    title: "AI generation started",
                    description: "Generating the script by AI, you can keep pulling other videos' script.",
                });

                // Start background polling
                if (onProjectUpdate) {
                    startJobPolling(result.jobId, videoId, pendingProject as AppProject, onProjectUpdate);
                }

                if (mountedRef.current) {
                    setIsProcessing(false);
                    setProcessingStep('');
                }
                return pendingProject as AppProject;
            }

            // Handle completed status (immediate transcript)
            const { transcript, videoTitle } = result;

            if (mountedRef.current) {
                setProcessingStep('Analyzing content with AI...');
            }
            const { vocabulary, grammar, detectedLanguage } = await analyzeContentWithAI(transcript);

            // Only generate practice sentences if we have vocabulary and grammar
            let practiceSentences: PracticeSentence[] = [];
            if (vocabulary.length > 0 && grammar.length > 0) {
                if (mountedRef.current) {
                    setProcessingStep('Generating practice sentences...');
                }
                practiceSentences = await generatePracticeSentences(vocabulary, grammar, detectedLanguage);
            }

            const project: AppProject = {
                id: Date.now(),
                title: videoTitle || `Video Lesson - ${videoId}`,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                script: transcript,
                vocabulary,
                grammar,
                detectedLanguage,
                practiceSentences,
                status: 'completed' as const,
                userId
            };

            toast({
                title: "Video processed successfully!",
                description: `Your lesson is ready for study. Language: ${detectedLanguage}`,
            });

            return project;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to process video";
            if (message === 'RATE_LIMIT_EXCEEDED') {
                toast({
                    title: "Rate Limit Exceeded",
                    description: "The transcript service is temporarily rate limited. Please wait a few minutes and try again.",
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Processing failed",
                    description: message,
                    variant: "destructive",
                });
            }
            throw error;
        } finally {
            if (mountedRef.current) {
                setIsProcessing(false);
                setProcessingStep('');
            }
        }
    };

    const regenerateAnalysis = async (currentProject: AppProject | null): Promise<AppProject | null> => {
        if (!currentProject) return null;

        if (mountedRef.current) {
            setIsProcessing(true);
            setProcessingStep('Re-analyzing content with AI...');
        }

        try {
            const { vocabulary, grammar, detectedLanguage } = await analyzeContentWithAI(currentProject.script);

            if (mountedRef.current) {
                setProcessingStep('Generating practice sentences...');
            }

            const practiceSentences = await generatePracticeSentences(vocabulary, grammar, detectedLanguage);

            if (mountedRef.current) {
                setProcessingStep('');
            }

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

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Could not regenerate analysis";
            console.error('Failed to regenerate analysis:', error);
            toast({
                title: "Regeneration failed",
                description: message,
                variant: "destructive",
            });
            return null;
        } finally {
            if (mountedRef.current) {
                setIsProcessing(false);
                setProcessingStep('');
            }
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
        generatePracticeSentences,
        cleanup
    };
};

import { useState, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useVideoProcessing = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState<string>('');
    const { toast } = useToast();
    const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

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
        try {
            console.log('Trying extract-transcript edge function for:', videoId, 'language:', languageCode || 'auto');
            const { data, error } = await supabase.functions.invoke('extract-transcript', {
                body: { videoId, languageCode }
            });

            // Check for pending status (202 with jobId)
            if (data?.status === 'pending' && data?.jobId) {
                console.log('✓ Transcript generation started, jobId:', data.jobId);
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
                console.log('✓ Successfully extracted transcript via extract-transcript');
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

            console.warn('extract-transcript failed or returned no transcript:', data?.error);
        } catch (err) {
            // Re-throw rate limit errors to be handled by processVideo
            if (err instanceof Error && err.message === 'RATE_LIMIT_EXCEEDED') {
                throw err;
            }
            console.warn('extract-transcript edge function failed:', err);
        }

        console.error('Transcript extraction failed for video:', videoId);
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

            // Check for rate limit or credit errors in the response
            if (data.error) {
                console.warn('AI analysis returned error:', data.error);
                toast({
                    title: "AI Analysis Issue",
                    description: data.error,
                    variant: "destructive"
                });
            }

            console.log('AI analysis result:', data);

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

    const startJobPolling = (jobId: string, videoId: string, initialProject: any, onComplete: (project: any) => void) => {
        console.log('Starting background polling for job:', jobId);
        
        const pollInterval = setInterval(async () => {
            try {
                console.log('Polling job:', jobId);
                const { data, error } = await supabase.functions.invoke('poll-transcript-job', {
                    body: { jobId, videoId }
                });

                if (error) {
                    console.error('Polling error:', error);
                    return;
                }

                if (data.status === 'completed') {
                    console.log('Job completed:', jobId);
                    clearInterval(pollInterval);
                    pollingIntervalsRef.current.delete(jobId);
                    
                    // Complete the processing
                    await completeProjectProcessing(initialProject, data.transcript, data.videoTitle, onComplete);
                } else if (data.status === 'failed') {
                    console.log('Job failed:', jobId, data.error);
                    clearInterval(pollInterval);
                    pollingIntervalsRef.current.delete(jobId);
                    
                    // Update project status to failed
                    await updateProjectToFailed(jobId, data.error);
                    toast({
                        title: "Generation failed",
                        description: data.error,
                        variant: "destructive"
                    });
                }
                // If still pending/processing, continue polling
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 60000); // 60 seconds

        pollingIntervalsRef.current.set(jobId, pollInterval);
    };

    const completeProjectProcessing = async (initialProject: any, transcript: string, videoTitle: string, onComplete: (project: any) => void) => {
        try {
            console.log('Completing project processing...');
            
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
            await supabase
                .from('projects')
                .update({
                    title: videoTitle,
                    script: transcript,
                    vocabulary,
                    grammar,
                    practice_sentences: practiceSentences,
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

            toast({
                title: "Video ready!",
                description: `"${videoTitle}" is now ready for study.`
            });

            onComplete(completedProject);
        } catch (error) {
            console.error('Failed to complete project processing:', error);
        }
    };

    const updateProjectToFailed = async (jobId: string, errorMessage: string) => {
        try {
            await supabase
                .from('projects')
                .update({
                    status: 'failed',
                    error_message: errorMessage,
                    updated_at: new Date().toISOString()
                })
                .eq('job_id', jobId);
        } catch (error) {
            console.error('Failed to update project status:', error);
        }
    };

    const processVideo = async (videoId: string, languageCode?: string, selectedLanguageName?: string, userId?: string, onProjectUpdate?: (project: any) => void) => {
        setIsProcessing(true);
        setProcessingStep('Extracting transcript...');

        try {
            const result = await fetchTranscript(videoId, languageCode);

            // Handle pending status (AI generation)
            if (result.status === 'pending' && result.jobId) {
                const pendingProject = {
                    id: Date.now(),
                    title: result.videoTitle,
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    script: '',
                    vocabulary: [],
                    grammar: [],
                    detectedLanguage: selectedLanguageName || 'Unknown',
                    practiceSentences: [],
                    status: 'pending',
                    jobId: result.jobId,
                    userId
                };

                toast({
                    title: "AI generation started",
                    description: "Generating the script by AI, you can keep pulling other videos' script.",
                });

                // Start background polling
                if (onProjectUpdate) {
                    startJobPolling(result.jobId, videoId, pendingProject, onProjectUpdate);
                }

                setIsProcessing(false);
                setProcessingStep('');
                return pendingProject;
            }

            // Handle completed status (immediate transcript)
            const { transcript, videoTitle } = result;

            setProcessingStep('Analyzing content with AI...');
            const { vocabulary, grammar, detectedLanguage: aiDetectedLang } = await analyzeContentWithAI(transcript);

            // Use selected language if available, otherwise use AI detected language
            const finalLanguage = selectedLanguageName || aiDetectedLang;

            // Only generate practice sentences if we have vocabulary and grammar
            let practiceSentences: any[] = [];
            if (vocabulary.length > 0 && grammar.length > 0) {
                setProcessingStep('Generating practice sentences...');
                practiceSentences = await generatePracticeSentences(vocabulary, grammar, finalLanguage);
            } else {
                console.log('Skipping practice sentence generation - no vocabulary or grammar data');
            }

            const project = {
                id: Date.now(),
                title: videoTitle || `Video Lesson - ${videoId}`,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                script: transcript,
                vocabulary,
                grammar,
                detectedLanguage: finalLanguage,
                practiceSentences,
                status: 'completed',
                userId
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

    const cleanup = () => {
        pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
        pollingIntervalsRef.current.clear();
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
        generatePracticeSentences,
        cleanup
    };
};

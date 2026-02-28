import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useWhisperSTT } from '@/hooks/useWhisperSTT';
import { languageToBCP47, isStopPhrase } from '@/lib/languageUtils';
import { saveSession } from '@/lib/conversationStorage';
import { useToast } from '@/hooks/use-toast';
import type { AppProject } from '@/types/project';
import type {
  ConversationMessage,
  ConversationSession,
  ConversationSummary,
  ConversationState,
} from '@/types/conversation';

export const useConversation = (project: AppProject | null) => {
  const [state, setState] = useState<ConversationState>({
    status: 'idle',
    messages: [],
    currentTranscript: '',
    error: null,
  });
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const mountedRef = useRef(true);
  const sessionIdRef = useRef('');
  const startedAtRef = useRef('');
  const messagesRef = useRef<ConversationMessage[]>([]);
  const processingRef = useRef(false);
  const stateStatusRef = useRef(state.status);

  const { toast } = useToast();
  const bcp47 = project ? languageToBCP47(project.detectedLanguage) : 'en-US';
  const { speak: openaiSpeak, stop: stopSpeaking, prime: primeSpeaking, isPlaying } = useTextToSpeech();

  // Wrap OpenAI TTS to pass language-appropriate voice instructions
  const speakRef = useRef<(text: string) => Promise<void>>();
  speakRef.current = async (text: string) => {
    const lang = project?.detectedLanguage || 'English';
    await openaiSpeak(
      text,
      'coral',
      `Speak naturally in ${lang}, like a friendly and patient language tutor having a casual conversation. Use a warm, encouraging tone.`
    );
  };
  const speak = useCallback(async (text: string) => {
    await speakRef.current?.(text);
  }, []);

  // Keep refs in sync
  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);

  useEffect(() => {
    stateStatusRef.current = state.status;
  }, [state.status]);

  const getProjectContext = useCallback(() => {
    if (!project) return null;
    return {
      vocabulary: project.vocabulary.map(v => ({
        word: v.word,
        definition: v.definition,
        meaning: v.meaning,
      })),
      grammar: project.grammar.map(g => ({
        rule: g.rule,
        example: g.example,
        explanation: g.explanation,
      })),
      detectedLanguage: project.detectedLanguage,
      title: project.title,
    };
  }, [project]);

  const callConversationChat = useCallback(async (messages: { role: string; text: string }[]) => {
    const projectContext = getProjectContext();
    if (!projectContext) throw new Error('No project context');

    const { data, error } = await supabase.functions.invoke('conversation-chat', {
      body: { messages, projectContext },
    });

    if (error) throw new Error(error.message || 'Failed to get AI response');
    if (!data?.success) throw new Error(data?.error || 'AI response failed');
    return data.reply as string;
  }, [getProjectContext]);

  const callConversationSummary = useCallback(async (messages: { role: string; text: string }[]) => {
    const projectContext = getProjectContext();
    if (!projectContext) throw new Error('No project context');

    const { data, error } = await supabase.functions.invoke('conversation-summary', {
      body: {
        messages,
        projectContext: {
          vocabulary: projectContext.vocabulary,
          grammar: projectContext.grammar,
          detectedLanguage: projectContext.detectedLanguage,
        },
      },
    });

    if (error) throw new Error(error.message || 'Failed to generate summary');
    if (!data?.success) throw new Error(data?.error || 'Summary generation failed');
    return data.summary as ConversationSummary;
  }, [getProjectContext]);

  // stopConversation ref to break circular dependency with processUserInput
  const stopConversationRef = useRef<() => Promise<void>>();

  const processUserInput = useCallback(async (text: string) => {
    if (!project || processingRef.current) return;
    if (!text.trim()) return;

    // Check for stop phrase
    if (isStopPhrase(text, project.detectedLanguage)) {
      stopConversationRef.current?.();
      return;
    }

    processingRef.current = true;

    // Add user message
    const userMsg: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      status: 'processing',
      currentTranscript: '',
    }));

    try {
      // Build message history for API (include the new user message)
      const apiMessages = [
        ...messagesRef.current.map(m => ({ role: m.role, text: m.text })),
        { role: 'user', text },
      ];

      const reply = await callConversationChat(apiMessages);

      if (!mountedRef.current) return;

      const aiMsg: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'ai',
        text: reply,
        timestamp: new Date().toISOString(),
      };

      // Generate audio first (keep showing "processing" state), then show text when audio starts
      try {
        await speak(reply);
      } catch (ttsError) {
        console.error('TTS error:', ttsError);
        // Continue — show text even if audio fails
      }

      if (!mountedRef.current) return;

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, aiMsg],
        status: 'speaking',
      }));
    } catch (error) {
      if (!mountedRef.current) return;
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      console.error('Conversation error:', error);
      setState(prev => ({ ...prev, status: 'error', error: msg }));
      toast({
        title: 'Conversation error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      processingRef.current = false;
    }
  }, [project, callConversationChat, speak, toast]);

  // ---------- STT: OpenAI Whisper (all platforms) ----------

  const {
    isListening, isSupported, transcript, finalTranscript,
    startListening, stopListening, resetTranscript,
    initMic: whisperInitMic, destroyMic: whisperDestroyMic,
    refreshMic: whisperRefreshMic,
  } = useWhisperSTT({ language: bcp47 });

  // Update current transcript in state
  useEffect(() => {
    if (transcript && stateStatusRef.current === 'listening') {
      setState(prev => ({ ...prev, currentTranscript: transcript }));
    }
  }, [transcript]);

  // Process final speech results
  const prevFinalRef = useRef('');
  useEffect(() => {
    if (finalTranscript && finalTranscript !== prevFinalRef.current && stateStatusRef.current === 'listening') {
      prevFinalRef.current = finalTranscript;
      stopListening('finalTranscript');
      processUserInput(finalTranscript);
    }
  }, [finalTranscript, processUserInput, stopListening]);

  // Stop STT while TTS is playing to prevent picking up AI's voice
  useEffect(() => {
    if (isPlaying && isListening) {
      stopListening('tts-playing');
    }
    if (!isPlaying && stateStatusRef.current === 'speaking' && mountedRef.current) {
      // On iOS, TTS playback switches the hardware audio session to
      // "playback" mode, causing the mic stream to produce silence.
      // Re-acquire the stream so the next recording captures real audio.
      whisperRefreshMic().catch(() => {});
      setState(prev => ({ ...prev, status: 'listening', currentTranscript: '' }));
      resetTranscript();
    }
  }, [isPlaying, isListening, stopListening, resetTranscript, whisperRefreshMic]);

  const startConversation = useCallback(async () => {
    if (!project) return;

    // Unlock audio playback on iOS Safari (must happen synchronously from tap)
    primeSpeaking();

    // Pre-init the mic so it's warm when the user taps the mic button
    whisperInitMic().catch(() => {});

    const id = crypto.randomUUID();
    sessionIdRef.current = id;
    startedAtRef.current = new Date().toISOString();
    processingRef.current = true;
    prevFinalRef.current = '';

    setState({
      status: 'processing',
      messages: [],
      currentTranscript: '',
      error: null,
    });
    setSession(null);

    try {
      // Get opening message from AI (no prior messages)
      const reply = await callConversationChat([]);

      if (!mountedRef.current) return;

      const aiMsg: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'ai',
        text: reply,
        timestamp: new Date().toISOString(),
      };

      // Generate audio first (keep showing "processing" state), then show text when audio starts
      try {
        await speak(reply);
      } catch (ttsError) {
        console.error('TTS error:', ttsError);
      }

      if (!mountedRef.current) return;

      setState({
        status: 'speaking',
        messages: [aiMsg],
        currentTranscript: '',
        error: null,
      });
    } catch (error) {
      if (!mountedRef.current) return;
      const msg = error instanceof Error ? error.message : 'Failed to start conversation';
      console.error('Start conversation error:', error);
      setState(prev => ({ ...prev, status: 'error', error: msg }));
      toast({
        title: 'Could not start conversation',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      processingRef.current = false;
    }
  }, [project, callConversationChat, speak, primeSpeaking, whisperInitMic, toast]);

  const stopConversation = useCallback(async () => {
    stopListening('stopConversation');
    stopSpeaking();
    processingRef.current = false;

    // Release mic hardware
    whisperDestroyMic();

    const currentMessages = messagesRef.current;

    setState(prev => ({ ...prev, status: 'idle', currentTranscript: '' }));

    // If we have user messages, generate summary
    const hasUserMessages = currentMessages.some(m => m.role === 'user');
    if (hasUserMessages) {
      setIsGeneratingSummary(true);

      try {
        const apiMessages = currentMessages.map(m => ({ role: m.role, text: m.text }));
        const summary = await callConversationSummary(apiMessages);

        if (!mountedRef.current) return;

        const completedSession: ConversationSession = {
          id: sessionIdRef.current,
          projectId: project?.id || '',
          projectTitle: project?.title || '',
          language: project?.detectedLanguage || '',
          messages: currentMessages,
          summary,
          startedAt: startedAtRef.current,
          endedAt: new Date().toISOString(),
          status: 'completed',
        };

        saveSession(completedSession);
        setSession(completedSession);
      } catch (error) {
        if (!mountedRef.current) return;
        console.error('Summary generation error:', error);

        // Save session without summary
        const errorSession: ConversationSession = {
          id: sessionIdRef.current,
          projectId: project?.id || '',
          projectTitle: project?.title || '',
          language: project?.detectedLanguage || '',
          messages: currentMessages,
          summary: null,
          startedAt: startedAtRef.current,
          endedAt: new Date().toISOString(),
          status: 'error',
        };
        saveSession(errorSession);
        setSession(errorSession);

        toast({
          title: 'Summary generation failed',
          description: 'Your conversation was saved but the summary could not be generated.',
          variant: 'destructive',
        });
      } finally {
        setIsGeneratingSummary(false);
      }
    }
  }, [project, callConversationSummary, stopListening, stopSpeaking, whisperDestroyMic, toast]);

  // Keep stopConversationRef in sync
  useEffect(() => {
    stopConversationRef.current = stopConversation;
  }, [stopConversation]);

  const sendTextMessage = useCallback((text: string) => {
    primeSpeaking(); // Unlock audio on iOS before async work
    processUserInput(text);
  }, [processUserInput, primeSpeaking]);

  // Push-to-talk: user taps mic button to start recording
  const startRecording = useCallback(() => {
    if (stateStatusRef.current !== 'listening') return;
    prevFinalRef.current = '';
    resetTranscript();
    startListening('mic-button');
  }, [startListening, resetTranscript]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopListening('unmount');
      whisperDestroyMic();
    };
  }, [stopListening, whisperDestroyMic]);

  return {
    state,
    session,
    isGeneratingSummary,
    isSupported,
    isListening,
    isPlaying,
    startConversation,
    stopConversation,
    sendTextMessage,
    startRecording,
    transcript,
  };
};

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Volume2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWhisperSTT } from '@/hooks/useWhisperSTT';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { languageToBCP47 } from '@/lib/languageUtils';
import type { QuizQuestion } from '@/types/quiz';

interface Props {
  question: QuizQuestion;
  onAnswer: (isCorrect: boolean) => void;
  language?: string;
}

// Simple similarity check: what fraction of target words appear in the transcript
function similarity(spoken: string, target: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  const targetWords = normalize(target).split(/\s+/).filter(Boolean);
  const spokenWords = normalize(spoken).split(/\s+/).filter(Boolean);
  if (targetWords.length === 0) return 0;
  const matched = targetWords.filter(tw => spokenWords.some(sw => sw === tw));
  return matched.length / targetWords.length;
}

export const ReadAfterMeQ: React.FC<Props> = ({ question, onAnswer, language }) => {
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [userSpeech, setUserSpeech] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const processedRef = useRef(false);

  const bcp47 = language ? languageToBCP47(language) : question.targetLanguage || 'en-US';

  const {
    isListening,
    isSupported,
    transcript,
    finalTranscript,
    startListening,
    stopListening,
    resetTranscript,
    initMic,
    destroyMic,
  } = useWhisperSTT({ language: bcp47, silenceDurationMs: 2500, noSpeechTimeoutMs: 15_000 });

  const { speak, isPlaying, stop } = useTextToSpeech();

  const targetText = question.targetText || question.question;
  const lang = language || 'English';

  // Track when transcription is in progress (between stop and result)
  useEffect(() => {
    if (transcript === '...') {
      setIsTranscribing(true);
    } else if (transcript !== '...') {
      setIsTranscribing(false);
    }
  }, [transcript]);

  const handlePlayAudio = useCallback(() => {
    if (isPlaying) {
      stop();
      return;
    }
    speak(targetText, 'coral', `Speak clearly and slowly in ${lang}, like a language tutor demonstrating pronunciation.`);
  }, [targetText, lang, isPlaying, speak, stop]);

  const handleToggleMic = useCallback(async () => {
    if (isListening) {
      stopListening('manual');
    } else {
      processedRef.current = false;
      resetTranscript();
      setUserSpeech('');
      await startListening('mic-button');
    }
  }, [isListening, startListening, stopListening, resetTranscript]);

  // Process final transcript from Whisper
  useEffect(() => {
    if (finalTranscript && !processedRef.current && !showResult) {
      processedRef.current = true;
      setUserSpeech(finalTranscript);

      const score = similarity(finalTranscript, targetText);
      const passed = score >= 0.7;
      setIsCorrect(passed);
      setShowResult(true);
      onAnswer(passed);
    }
  }, [finalTranscript, targetText, onAnswer, showResult]);

  // Cleanup mic on unmount
  useEffect(() => {
    return () => {
      destroyMic();
    };
  }, [destroyMic]);

  return (
    <div>
      <h3 className="text-lg font-semibold text-center mb-2">Read after me</h3>

      {/* Target text to read */}
      <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg text-center">
        <p className="text-2xl font-bold mb-2">{targetText}</p>
        <Button variant="ghost" size="sm" onClick={handlePlayAudio} className="gap-2">
          {isPlaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
          {isPlaying ? 'Playing…' : 'Listen'}
        </Button>
      </div>

      {/* Status feedback */}
      {isListening && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg text-center">
          <p className="text-sm text-red-600 dark:text-red-400 animate-pulse">Recording… Speak now</p>
        </div>
      )}
      {isTranscribing && !isListening && (
        <div className="mb-4 p-3 bg-muted rounded-lg text-center">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Processing your speech…
          </p>
        </div>
      )}

      {/* Mic button */}
      {!showResult && (
        <div className="flex flex-col items-center mb-4">
          {isSupported ? (
            <>
              <Button
                onClick={handleToggleMic}
                size="lg"
                variant={isListening ? 'destructive' : 'default'}
                className={cn('rounded-full w-16 h-16', isListening && 'animate-pulse')}
                disabled={isTranscribing}
              >
                {isTranscribing ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : isListening ? (
                  <Square className="w-5 h-5" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                {isTranscribing ? 'Processing…' : isListening ? 'Tap to stop' : 'Tap to speak'}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Speech recognition is not supported in your browser.
              <Button variant="link" size="sm" onClick={() => { setShowResult(true); setIsCorrect(true); onAnswer(true); }}>
                Skip
              </Button>
            </p>
          )}
        </div>
      )}

      {/* Result */}
      {showResult && (
        <div className={cn('mt-4 p-4 rounded-lg text-center animate-fade-in', isCorrect ? 'bg-green-100 dark:bg-green-950/50' : 'bg-destructive/10')}>
          <p className={cn('font-semibold', isCorrect ? 'text-green-700 dark:text-green-400' : 'text-destructive')}>
            {isCorrect ? 'Great pronunciation!' : 'Try to match the text more closely'}
          </p>
          {userSpeech && (
            <p className="text-sm text-muted-foreground mt-1">You said: "{userSpeech}"</p>
          )}
        </div>
      )}
    </div>
  );
};

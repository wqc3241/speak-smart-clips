import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
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
  } = useSpeechRecognition({
    language: bcp47,
    continuous: false,
    interimResults: true,
  });

  const targetText = question.targetText || question.question;

  // Use browser TTS to pronounce the target text
  const handlePlayAudio = useCallback(() => {
    const utterance = new SpeechSynthesisUtterance(targetText);
    utterance.lang = bcp47;
    utterance.rate = 0.85;
    speechSynthesis.speak(utterance);
  }, [targetText, bcp47]);

  const handleToggleMic = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      processedRef.current = false;
      resetTranscript();
      setUserSpeech('');
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript]);

  // Process final transcript
  useEffect(() => {
    if (finalTranscript && !processedRef.current && !showResult) {
      processedRef.current = true;
      stopListening();
      setUserSpeech(finalTranscript);

      const score = similarity(finalTranscript, targetText);
      const passed = score >= 0.7;
      setIsCorrect(passed);
      setShowResult(true);
      onAnswer(passed);
    }
  }, [finalTranscript, targetText, onAnswer, stopListening, showResult]);

  return (
    <div>
      <h3 className="text-lg font-semibold text-center mb-2">Read after me</h3>

      {/* Target text to read */}
      <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg text-center">
        <p className="text-2xl font-bold mb-2">{targetText}</p>
        <Button variant="ghost" size="sm" onClick={handlePlayAudio} className="gap-2">
          <Volume2 className="w-4 h-4" />
          Listen
        </Button>
      </div>

      {/* Live transcript */}
      {isListening && transcript && (
        <div className="mb-4 p-3 bg-muted rounded-lg text-center">
          <p className="text-sm text-muted-foreground">You said:</p>
          <p className="text-lg">{transcript}</p>
        </div>
      )}

      {/* Mic button */}
      {!showResult && (
        <div className="flex justify-center mb-4">
          {isSupported ? (
            <Button
              onClick={handleToggleMic}
              size="lg"
              variant={isListening ? 'destructive' : 'default'}
              className="rounded-full w-16 h-16"
            >
              {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>
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

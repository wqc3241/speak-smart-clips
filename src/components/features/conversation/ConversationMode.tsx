import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mic,
  MicOff,
  Send,
  Square,
  Volume2,
  Loader2,
  Star,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageCircle,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { useConversation } from '@/hooks/useConversation';
import { ConversationHistory } from './ConversationHistory';
import type { AppProject } from '@/types/project';

interface ConversationModeProps {
  project: AppProject;
}

export const ConversationMode: React.FC<ConversationModeProps> = ({ project }) => {
  const {
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
  } = useConversation(project);

  const [textInput, setTextInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages, state.currentTranscript]);

  const handleSendText = () => {
    if (!textInput.trim()) return;
    sendTextMessage(textInput.trim());
    setTextInput('');
  };

  const statusLabel = () => {
    switch (state.status) {
      case 'listening': return isListening ? 'Listening...' : 'Tap mic to speak';
      case 'processing': return 'Thinking...';
      case 'speaking': return 'Speaking...';
      case 'error': return 'Error';
      default: return '';
    }
  };

  const statusColor = () => {
    switch (state.status) {
      case 'listening': return 'text-green-600 dark:text-green-400';
      case 'processing': return 'text-yellow-600 dark:text-yellow-400';
      case 'speaking': return 'text-blue-600 dark:text-blue-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  // Browser not supported
  if (!isSupported) {
    return (
      <div className="space-y-6">
        {/* Summary states (after a text-only conversation ends) */}
        {state.status === 'idle' && isGeneratingSummary && (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing your conversation...</p>
            </CardContent>
          </Card>
        )}

        {state.status === 'idle' && session && !isGeneratingSummary && (
          <SessionSummaryCard session={session} onStartNew={() => startConversation()} />
        )}

        {/* Show start card only when idle with no summary */}
        {(state.status !== 'idle' || (!session && !isGeneratingSummary)) && (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500" />
              <h3 className="text-lg font-semibold">Speech Recognition Not Supported</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Your browser doesn't support the Web Speech API. Please use Google Chrome or Microsoft Edge for voice conversations.
              </p>
              <p className="text-sm text-muted-foreground">
                You can still use the text input below to have a conversation.
              </p>
              {/* Allow text-only conversation */}
              <Button onClick={startConversation} disabled={state.status !== 'idle'}>
                <MessageCircle className="w-4 h-4 mr-2" />
                Start Text Conversation
              </Button>
            </CardContent>
          </Card>
        )}

        {state.status !== 'idle' && (
          <ActiveConversation
            state={state}
            isListening={false}
            isPlaying={isPlaying}
            transcript={transcript}
            statusLabel={statusLabel()}
            statusColor={statusColor()}
            textInput={textInput}
            setTextInput={setTextInput}
            handleSendText={handleSendText}
            stopConversation={stopConversation}
            startRecording={startRecording}
            scrollRef={scrollRef}
          />
        )}

        <ConversationHistory />
      </div>
    );
  }

  // Idle state — show start button
  if (state.status === 'idle' && !session && !isGeneratingSummary) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mic className="w-5 h-5 text-primary" />
              Voice Conversation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium">Practice speaking with AI</p>
              <p className="text-xs text-muted-foreground">
                Have a real-time voice conversation using vocabulary and grammar from "{project.title}".
                The AI will speak in {project.detectedLanguage} and gently correct your mistakes.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="text-xs">{project.vocabulary.length} vocabulary words</Badge>
                <Badge variant="outline" className="text-xs">{project.grammar.length} grammar patterns</Badge>
                <Badge variant="outline" className="text-xs">{project.detectedLanguage}</Badge>
              </div>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground text-sm">How it works:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Click "Start Conversation" — the AI will greet you</li>
                <li>Speak naturally — your speech is transcribed in real-time</li>
                <li>The AI responds with voice and text</li>
                <li>Say "stop" or click the Stop button to end</li>
                <li>Get a detailed summary with feedback and score</li>
              </ol>
            </div>

            <Button onClick={startConversation} className="w-full" size="lg">
              <Mic className="w-5 h-5 mr-2" />
              Start Conversation
            </Button>
          </CardContent>
        </Card>

        <ConversationHistory />
      </div>
    );
  }

  // Summary / generating summary state
  if (state.status === 'idle' && (isGeneratingSummary || session)) {
    return (
      <div className="space-y-6">
        {isGeneratingSummary && (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing your conversation...</p>
            </CardContent>
          </Card>
        )}

        {session && !isGeneratingSummary && (
          <SessionSummaryCard session={session} onStartNew={() => {
            startConversation();
          }} />
        )}

        <ConversationHistory />
      </div>
    );
  }

  // Active conversation
  return (
    <div className="space-y-4">
      <ActiveConversation
        state={state}
        isListening={isListening}
        isPlaying={isPlaying}
        transcript={transcript}
        statusLabel={statusLabel()}
        statusColor={statusColor()}
        textInput={textInput}
        setTextInput={setTextInput}
        handleSendText={handleSendText}
        stopConversation={stopConversation}
        startRecording={startRecording}
        scrollRef={scrollRef}
      />
    </div>
  );
};

// ——— Sub-components ———

interface ActiveConversationProps {
  state: { status: string; messages: { id: string; role: string; text: string }[]; currentTranscript: string; error: string | null };
  isListening: boolean;
  isPlaying: boolean;
  transcript: string;
  statusLabel: string;
  statusColor: string;
  textInput: string;
  setTextInput: (v: string) => void;
  handleSendText: () => void;
  stopConversation: () => void;
  startRecording: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

const ActiveConversation: React.FC<ActiveConversationProps> = ({
  state,
  isListening,
  isPlaying,
  transcript,
  statusLabel,
  statusColor,
  textInput,
  setTextInput,
  handleSendText,
  stopConversation,
  startRecording,
  scrollRef,
}) => (
  <Card className="flex flex-col h-[calc(100vh-220px)] md:h-[600px]">
    {/* Status bar */}
    <div className="flex items-center justify-between px-4 py-2 border-b">
      <div className="flex items-center gap-2">
        {state.status === 'listening' && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
        )}
        {state.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin" />}
        {state.status === 'speaking' && <Volume2 className="w-4 h-4 animate-pulse text-blue-500" />}
        <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
      </div>
      <Button variant="destructive" size="sm" onClick={stopConversation}>
        <Square className="w-3 h-3 mr-1" />
        Stop
      </Button>
    </div>

    {/* Messages */}
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="p-4 space-y-3">
        {state.messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] md:max-w-[70%] p-3 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              <p className="text-sm">{msg.text}</p>
            </div>
          </div>
        ))}

        {/* Live transcript */}
        {(state.currentTranscript || transcript) && state.status === 'listening' && (
          <div className="flex justify-end">
            <div className="max-w-[85%] md:max-w-[70%] p-3 rounded-2xl bg-primary/20 text-foreground border border-primary/30">
              <p className="text-sm italic">{state.currentTranscript || transcript}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div className="p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
            {state.error}
          </div>
        )}
      </div>
    </ScrollArea>

    {/* Text input fallback */}
    <div className="p-3 border-t">

      <div className="flex gap-2">
        {state.status === 'listening' && !isListening ? (
          <button
            onClick={startRecording}
            aria-label="Start recording"
            className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground ring-2 ring-primary/50 animate-pulse hover:ring-primary/80 transition-all"
          >
            <Mic className="w-5 h-5" />
          </button>
        ) : isListening ? (
          <div
            aria-label="Recording"
            className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-green-500 text-white animate-pulse"
          >
            <Mic className="w-5 h-5" />
          </div>
        ) : (
          <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-muted">
            <MicOff className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        <Input
          placeholder="Type a message..."
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSendText()}
          disabled={state.status === 'processing' || state.status === 'speaking'}
          className="flex-1"
        />
        <Button
          onClick={handleSendText}
          disabled={!textInput.trim() || state.status === 'processing' || state.status === 'speaking'}
          size="icon"
          className="shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  </Card>
);

interface SessionSummaryCardProps {
  session: {
    summary: {
      overallScore: number;
      overallComment: string;
      sentencesUsed: { original: string; corrected: string; translation: string; isCorrect: boolean }[];
      vocabularyUsed: { word: string; usedCorrectly: boolean; context: string; suggestion?: string }[];
      grammarPatterns: { pattern: string; usedCorrectly: boolean; example: string; correction?: string }[];
      feedback: { category: string; message: string; severity: 'positive' | 'suggestion' | 'correction' }[];
    } | null;
    messages: { id: string; role: string; text: string }[];
  };
  onStartNew: () => void;
}

const SessionSummaryCard: React.FC<SessionSummaryCardProps> = ({ session, onStartNew }) => {
  const { summary } = session;

  if (!summary) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 mx-auto text-yellow-500" />
          <p className="text-sm text-muted-foreground">Summary could not be generated.</p>
          <p className="text-xs text-muted-foreground">
            Your conversation ({session.messages.length} messages) was saved to history.
          </p>
          <Button onClick={onStartNew}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Start New Conversation
          </Button>
        </CardContent>
      </Card>
    );
  }

  const scoreColor = summary.overallScore >= 7
    ? 'text-green-600 dark:text-green-400'
    : summary.overallScore >= 4
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Session Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Overall score */}
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <p className={`text-4xl font-bold ${scoreColor}`}>{summary.overallScore}<span className="text-lg text-muted-foreground">/10</span></p>
          <p className="text-sm text-muted-foreground mt-1">{summary.overallComment}</p>
        </div>

        {/* Sentences */}
        {summary.sentencesUsed.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Your Sentences</h4>
            <div className="space-y-2">
              {summary.sentencesUsed.map((s, i) => (
                <div key={i} className="p-3 border rounded-lg text-sm">
                  <div className="flex items-start gap-2">
                    {s.isCorrect
                      ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />}
                    <div>
                      <p>{s.original}</p>
                      {!s.isCorrect && (
                        <p className="text-green-700 dark:text-green-400 mt-1">→ {s.corrected}</p>
                      )}
                      <p className="text-muted-foreground text-xs mt-1">{s.translation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vocabulary */}
        {summary.vocabularyUsed.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Vocabulary Used</h4>
            <div className="space-y-1.5">
              {summary.vocabularyUsed.map((v, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  {v.usedCorrectly
                    ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />}
                  <div>
                    <span className="font-medium">{v.word}</span>
                    <span className="text-muted-foreground"> — {v.context}</span>
                    {v.suggestion && <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">{v.suggestion}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grammar */}
        {summary.grammarPatterns.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Grammar Patterns</h4>
            <div className="space-y-1.5">
              {summary.grammarPatterns.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  {g.usedCorrectly
                    ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />}
                  <div>
                    <span className="font-medium">{g.pattern}</span>
                    <span className="text-muted-foreground"> — {g.example}</span>
                    {g.correction && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">→ {g.correction}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        {summary.feedback.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Feedback</h4>
            <div className="space-y-2">
              {summary.feedback.map((fb, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  {fb.severity === 'positive' && <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />}
                  {fb.severity === 'suggestion' && <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />}
                  {fb.severity === 'correction' && <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />}
                  <div>
                    <span className="font-medium">{fb.category}:</span>{' '}
                    <span className="text-muted-foreground">{fb.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={onStartNew} className="w-full">
          <RotateCcw className="w-4 h-4 mr-2" />
          Start New Conversation
        </Button>
      </CardContent>
    </Card>
  );
};

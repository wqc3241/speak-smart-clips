import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
  Star,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { loadSessions, deleteSession, clearAllSessions } from '@/lib/conversationStorage';
import type { ConversationSession } from '@/types/conversation';

export const ConversationHistory: React.FC = () => {
  const [sessions, setSessions] = useState<ConversationSession[]>(() => loadSessions());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = () => setSessions(loadSessions());

  const handleDelete = (id: string) => {
    deleteSession(id);
    refresh();
  };

  const handleClearAll = () => {
    clearAllSessions();
    refresh();
  };

  if (sessions.length === 0) {
    return null;
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'positive': return 'text-green-600 dark:text-green-400';
      case 'suggestion': return 'text-yellow-600 dark:text-yellow-400';
      case 'correction': return 'text-red-600 dark:text-red-400';
      default: return '';
    }
  };

  const SeverityIcon = ({ severity }: { severity: string }) => {
    switch (severity) {
      case 'positive': return <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />;
      case 'correction': return <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />;
      default: return <AlertCircle className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" />
            Conversation History
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-xs text-muted-foreground">
            Clear all
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sessions.map(s => {
          const isExpanded = expandedId === s.id;
          const msgCount = s.messages.length;
          const userMsgCount = s.messages.filter(m => m.role === 'user').length;

          return (
            <div key={s.id} className="border rounded-lg">
              <button
                className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.projectTitle}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{s.language}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(s.startedAt)}</span>
                    <span className="text-xs text-muted-foreground">{msgCount} msgs</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {s.summary && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-yellow-500" />
                      <span className="text-sm font-semibold">{s.summary.overallScore}/10</span>
                    </div>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t px-3 pb-3">
                  {/* Transcript */}
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Conversation ({userMsgCount} exchanges)
                    </p>
                    <ScrollArea className="max-h-48">
                      <div className="space-y-2">
                        {s.messages.map(m => (
                          <div
                            key={m.id}
                            className={`text-xs p-2 rounded ${
                              m.role === 'user'
                                ? 'bg-primary/10 ml-8'
                                : 'bg-muted mr-8'
                            }`}
                          >
                            <span className="font-semibold">{m.role === 'user' ? 'You' : 'AI'}:</span>{' '}
                            {m.text}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Summary */}
                  {s.summary && (
                    <div className="mt-4 space-y-3">
                      {/* Overall */}
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className="font-semibold text-sm">Score: {s.summary.overallScore}/10</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{s.summary.overallComment}</p>
                      </div>

                      {/* Sentences review */}
                      {s.summary.sentencesUsed.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                            Sentences Review
                          </p>
                          <div className="space-y-1.5">
                            {s.summary.sentencesUsed.map((sent, i) => (
                              <div key={i} className="text-xs p-2 border rounded">
                                <div className="flex items-start gap-1.5">
                                  {sent.isCorrect
                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                                    : <XCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" />}
                                  <div>
                                    <p>{sent.original}</p>
                                    {!sent.isCorrect && (
                                      <p className="text-green-700 dark:text-green-400 mt-0.5">{sent.corrected}</p>
                                    )}
                                    <p className="text-muted-foreground mt-0.5">{sent.translation}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Vocabulary */}
                      {s.summary.vocabularyUsed.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                            Vocabulary Used
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {s.summary.vocabularyUsed.map((v, i) => (
                              <Badge
                                key={i}
                                variant={v.usedCorrectly ? 'default' : 'destructive'}
                                className="text-xs"
                                title={v.suggestion || v.context}
                              >
                                {v.word}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Grammar */}
                      {s.summary.grammarPatterns.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                            Grammar Patterns
                          </p>
                          <div className="space-y-1">
                            {s.summary.grammarPatterns.map((g, i) => (
                              <div key={i} className="text-xs flex items-start gap-1.5">
                                {g.usedCorrectly
                                  ? <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 shrink-0" />
                                  : <XCircle className="w-3 h-3 text-red-600 mt-0.5 shrink-0" />}
                                <span>
                                  <strong>{g.pattern}</strong>: {g.example}
                                  {g.correction && <span className="text-red-600 dark:text-red-400"> → {g.correction}</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Feedback */}
                      {s.summary.feedback.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                            Feedback
                          </p>
                          <div className="space-y-1">
                            {s.summary.feedback.map((fb, i) => (
                              <div key={i} className={`text-xs flex items-start gap-1.5 ${severityColor(fb.severity)}`}>
                                <SeverityIcon severity={fb.severity} />
                                <span><strong>{fb.category}:</strong> {fb.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(s.id);
                      }}
                      className="text-xs text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

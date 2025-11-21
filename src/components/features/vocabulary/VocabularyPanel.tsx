import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Book, GraduationCap, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { Loader2 } from "lucide-react";

interface VocabularyItem {
  word: string;
  definition: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

interface GrammarItem {
  rule: string;
  example: string;
  explanation: string;
}

interface VocabularyPanelProps {
  vocabulary: VocabularyItem[];
  grammar: GrammarItem[];
  detectedLanguage?: string;
}

export const VocabularyPanel: React.FC<VocabularyPanelProps> = ({
  vocabulary,
  grammar,
  detectedLanguage
}) => {
  const { speak, isPlaying, currentText } = useTextToSpeech();

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner": return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "intermediate": return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
      case "advanced": return "bg-red-500/10 text-red-700 dark:text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-4">
      {/* Vocabulary Card */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Book className="w-5 h-5 text-primary" />
            Vocabulary
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ScrollArea className="h-[250px] md:h-[300px]">
            <div className="space-y-2 pr-4">
              {vocabulary.map((item, index) => (
                <div key={index} className="p-3 bg-accent/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-base">{item.word}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => speak(item.word)}
                    >
                      {isPlaying && currentText === item.word ? (
                        <Volume2 className="h-3.5 w-3.5 animate-pulse text-primary" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                    <Badge className={getDifficultyColor(item.difficulty)} variant="outline">
                      {item.difficulty}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.definition}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Grammar Card */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            Grammar
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ScrollArea className="h-[250px] md:h-[300px]">
            <div className="space-y-2 pr-4">
              {grammar.map((item, index) => (
                <div key={index} className="p-3 bg-accent/50 rounded-lg">
                  <h4 className="font-semibold text-sm text-foreground mb-1">{item.rule}</h4>
                  <div className="flex items-start gap-2 mb-1">
                    <p className="text-xs italic text-muted-foreground flex-1">"{item.example}"</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0"
                      onClick={() => speak(item.example)}
                    >
                      {isPlaying && currentText === item.example ? (
                        <Volume2 className="h-3 w-3 animate-pulse text-primary" />
                      ) : (
                        <Volume2 className="h-3 w-3 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-foreground">{item.explanation}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

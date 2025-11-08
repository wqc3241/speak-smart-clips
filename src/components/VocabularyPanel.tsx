import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Book, GraduationCap, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
export const VocabularyPanel: React.FC<VocabularyPanelProps> = ({ vocabulary, grammar, detectedLanguage }) => {
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);
  const { toast } = useToast();

  const getLanguageCode = (language?: string): string => {
    const languageMap: Record<string, string> = {
      "japanese": "ja-JP",
      "english": "en-US",
      "spanish": "es-ES",
      "french": "fr-FR",
      "chinese": "zh-CN",
      "korean": "ko-KR",
      "german": "de-DE",
      "italian": "it-IT",
      "portuguese": "pt-PT",
    };
    return languageMap[language?.toLowerCase() || ""] || "en-US";
  };

  const speakWord = (word: string) => {
    if (!('speechSynthesis' in window)) {
      toast({
        title: "Not Supported",
        description: "Text-to-speech is not supported in your browser.",
        variant: "destructive",
      });
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    setSpeakingWord(word);
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = getLanguageCode(detectedLanguage);
    utterance.rate = 0.8; // Slightly slower for learning
    
    utterance.onend = () => {
      setSpeakingWord(null);
    };

    utterance.onerror = () => {
      setSpeakingWord(null);
      toast({
        title: "Pronunciation Error",
        description: "Could not pronounce this word.",
        variant: "destructive",
      });
    };

    window.speechSynthesis.speak(utterance);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-100 text-green-800";
      case "intermediate":
        return "bg-yellow-100 text-yellow-800";
      case "advanced":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Book className="w-5 h-5 text-blue-500" />
            Key Vocabulary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            <div className="space-y-3">
              {vocabulary.map((item, index) => (
                <div key={index} className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-lg">{item.word}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => speakWord(item.word)}
                      disabled={speakingWord === item.word}
                    >
                      <Volume2 className={`h-4 w-4 ${speakingWord === item.word ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                    </Button>
                    <Badge className={getDifficultyColor(item.difficulty)}>{item.difficulty}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.definition}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-purple-500" />
            Key Grammar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            <div className="space-y-3">
              {grammar.map((item, index) => (
                <div key={index} className="p-3 bg-muted rounded-lg">
                  <h4 className="font-semibold text-base text-primary mb-1">{item.rule}</h4>
                  <p className="text-sm italic text-muted-foreground mb-2">"{item.example}"</p>
                  <p className="text-sm text-foreground">{item.explanation}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

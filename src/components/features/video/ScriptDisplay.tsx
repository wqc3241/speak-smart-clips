import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Highlighter, Volume2, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";

interface ScriptDisplayProps {
  script: string;
  language?: string;
}

export const ScriptDisplay: React.FC<ScriptDisplayProps> = ({ script }) => {
  const [highlightedWords, setHighlightedWords] = useState<string[]>([]);
  const { toast } = useToast();
  const { speak, isPlaying, currentText } = useTextToSpeech();

  const handleWordClick = (word: string) => {
    const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
    if (highlightedWords.includes(cleanWord)) {
      setHighlightedWords(highlightedWords.filter(w => w !== cleanWord));
    } else {
      setHighlightedWords([...highlightedWords, cleanWord]);
    }
  };

  const handleSpeak = () => {
    speak(script);
  };

  const renderScript = () => {
    return script.split(' ').map((word, index) => {
      const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
      const isHighlighted = highlightedWords.includes(cleanWord);

      return (
        <span
          key={index}
          className={`cursor-pointer hover:bg-accent px-1 py-0.5 rounded transition-colors ${isHighlighted ? 'bg-primary/20 font-medium' : ''
            }`}
          onClick={() => handleWordClick(word)}
        >
          {word}{' '}
        </span>
      );
    });
  };

  return (
    <Card className="h-full border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Script
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleSpeak}>
              {isPlaying && currentText === script ? (
                <Volume2 className="w-4 h-4 text-primary animate-pulse" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setHighlightedWords([])}>
              <Highlighter className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <ScrollArea className="h-[300px] md:h-[400px] w-full">
          <div className="text-sm md:text-base leading-relaxed text-foreground pr-4">
            {renderScript()}
          </div>
        </ScrollArea>
        <p className="mt-3 text-xs text-muted-foreground">
          Tap words to highlight
        </p>
      </CardContent>
    </Card>
  );
};

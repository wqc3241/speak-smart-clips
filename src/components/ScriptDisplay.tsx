import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Highlighter } from 'lucide-react';

interface ScriptDisplayProps {
  script: string;
}

export const ScriptDisplay: React.FC<ScriptDisplayProps> = ({ script }) => {
  const [highlightedWords, setHighlightedWords] = useState<string[]>([]);

  const handleWordClick = (word: string) => {
    const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
    if (highlightedWords.includes(cleanWord)) {
      setHighlightedWords(highlightedWords.filter(w => w !== cleanWord));
    } else {
      setHighlightedWords([...highlightedWords, cleanWord]);
    }
  };

  const renderScript = () => {
    return script.split(' ').map((word, index) => {
      const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
      const isHighlighted = highlightedWords.includes(cleanWord);
      
      return (
        <span
          key={index}
          className={`cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded transition-colors ${
            isHighlighted ? 'bg-yellow-200 font-semibold' : ''
          }`}
          onClick={() => handleWordClick(word)}
        >
          {word}{' '}
        </span>
      );
    });
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-green-500" />
          Video Script
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setHighlightedWords([])}>
            <Highlighter className="w-4 h-4 mr-2" />
            Clear Highlights
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 w-full">
          <div className="text-base leading-relaxed text-gray-700">
            {renderScript()}
          </div>
        </ScrollArea>
        <div className="mt-4 text-sm text-gray-500">
          Click on words to highlight them for study
        </div>
      </CardContent>
    </Card>
  );
};


import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Book, GraduationCap } from 'lucide-react';

interface VocabularyItem {
  word: string;
  definition: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface GrammarItem {
  rule: string;
  example: string;
  explanation: string;
}

interface VocabularyPanelProps {
  vocabulary: VocabularyItem[];
  grammar: GrammarItem[];
}

export const VocabularyPanel: React.FC<VocabularyPanelProps> = ({ vocabulary, grammar }) => {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-lg">{item.word}</span>
                    <Badge className={getDifficultyColor(item.difficulty)}>
                      {item.difficulty}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{item.definition}</p>
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
            Grammar Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            <div className="space-y-3">
              {grammar.map((item, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-base text-purple-700 mb-1">
                    {item.rule}
                  </h4>
                  <p className="text-sm italic text-gray-600 mb-2">
                    "{item.example}"
                  </p>
                  <p className="text-sm text-gray-700">{item.explanation}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

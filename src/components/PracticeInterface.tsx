import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Volume2, RefreshCw, BookOpen, GraduationCap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface PracticeSentence {
  text: string;
  translation: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  usedVocabulary: string[];
  usedGrammar: string[];
}

interface PracticeInterfaceProps {
  project: any;
  onSentencesUpdate?: (sentences: PracticeSentence[]) => void;
}

export const PracticeInterface: React.FC<PracticeInterfaceProps> = ({ project, onSentencesUpdate }) => {
  const [practiceSentences, setPracticeSentences] = useState<PracticeSentence[]>(project.practiceSentences || []);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSpeaking, setCurrentSpeaking] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const { toast } = useToast();

  const getLanguageCode = (language?: string) => {
    const languageMap: { [key: string]: string } = {
      'japanese': 'ja-JP',
      'spanish': 'es-ES',
      'french': 'fr-FR',
      'german': 'de-DE',
      'italian': 'it-IT',
      'portuguese': 'pt-PT',
      'chinese': 'zh-CN',
      'korean': 'ko-KR',
      'russian': 'ru-RU',
    };
    return languageMap[language?.toLowerCase() || ""] || "en-US";
  };

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) {
      toast({
        title: "Not Supported",
        description: "Text-to-speech is not supported in your browser.",
        variant: "destructive",
      });
      return;
    }

    window.speechSynthesis.cancel();

    setCurrentSpeaking(text);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getLanguageCode(project.detectedLanguage);
    utterance.rate = 0.8;
    
    utterance.onend = () => setCurrentSpeaking(null);
    
    utterance.onerror = () => {
      setCurrentSpeaking(null);
      toast({
        title: "Pronunciation Error",
        description: "Could not pronounce this text.",
        variant: "destructive",
      });
    };

    window.speechSynthesis.speak(utterance);
  };

  const generateSentences = async () => {
    setIsLoading(true);
    
    try {
      console.log('Generating practice sentences...');
      
      const { data, error } = await supabase.functions.invoke('generate-practice-sentences', {
        body: {
          vocabulary: project.vocabulary,
          grammar: project.grammar,
          detectedLanguage: project.detectedLanguage,
          count: 10
        }
      });

      if (error) {
        console.error('Error generating sentences:', error);
        throw error;
      }

      if (data?.sentences && data.sentences.length > 0) {
        setPracticeSentences(data.sentences);
        onSentencesUpdate?.(data.sentences); // Update parent state
        toast({
          title: "Practice sentences generated!",
          description: `Created ${data.sentences.length} sentences for practice.`,
        });
      } else {
        toast({
          title: "No sentences generated",
          description: "Try again or check if vocabulary and grammar are available.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Failed to generate sentences:', error);
      toast({
        title: "Generation failed",
        description: error.message || "Could not generate practice sentences",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update sentences when project changes
  useEffect(() => {
    setPracticeSentences(project.practiceSentences || []);
  }, [project]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 border-green-200';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'advanced': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredSentences = difficultyFilter === 'all' 
    ? practiceSentences 
    : practiceSentences.filter(s => s.difficulty === difficultyFilter);

  return (
    <div className="space-y-4">
      {/* Header with Generate Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          Practice Sentences
        </h2>
        <Button 
          variant="outline" 
          size="sm"
          onClick={generateSentences}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Generate
        </Button>
      </div>

      {/* Difficulty Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button 
          variant={difficultyFilter === 'all' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setDifficultyFilter('all')}
        >
          All ({practiceSentences.length})
        </Button>
        <Button 
          variant={difficultyFilter === 'beginner' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setDifficultyFilter('beginner')}
        >
          Beginner
        </Button>
        <Button 
          variant={difficultyFilter === 'intermediate' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setDifficultyFilter('intermediate')}
        >
          Intermediate
        </Button>
        <Button 
          variant={difficultyFilter === 'advanced' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setDifficultyFilter('advanced')}
        >
          Advanced
        </Button>
      </div>

      {/* Practice Sentences List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-3" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredSentences.length === 0 ? (
        <Card className="p-8 text-center bg-muted/30 border-border">
          <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-base font-semibold text-muted-foreground mb-1">
            {practiceSentences.length === 0 
              ? 'No practice sentences yet'
              : 'No sentences at this level'
            }
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            {practiceSentences.length === 0
              ? 'Generate sentences to start practicing'
              : 'Try a different difficulty level'
            }
          </p>
          {practiceSentences.length === 0 && (
            <Button onClick={generateSentences} size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate Sentences
            </Button>
          )}
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-280px)] md:h-[600px]">
          <div className="space-y-3 pr-4">
            {filteredSentences.map((sentence, index) => (
              <Card key={index} className="p-4 border-border hover:border-primary/50 transition-colors">
                {/* Sentence with Audio */}
                <div className="flex items-start gap-3 mb-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 mt-0.5"
                    onClick={() => speak(sentence.text)}
                    disabled={currentSpeaking === sentence.text}
                  >
                    <Volume2 className={`h-4 w-4 ${
                      currentSpeaking === sentence.text ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-foreground mb-1 break-words">
                      {sentence.text}
                    </p>
                    <p className="text-sm text-muted-foreground italic break-words">
                      {sentence.translation}
                    </p>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 items-center mt-3">
                  <Badge className={getDifficultyColor(sentence.difficulty)} variant="outline">
                    {sentence.difficulty}
                  </Badge>
                  
                  {sentence.usedVocabulary.length > 0 && (
                    <>
                      {sentence.usedVocabulary.slice(0, 3).map((word, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {word}
                        </Badge>
                      ))}
                      {sentence.usedVocabulary.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{sentence.usedVocabulary.length - 3}
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Hidden Reference Panel for larger screens */}
      <div className="hidden xl:block">
        <Card className="xl:sticky xl:top-4 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {project.vocabulary?.slice(0, 5).map((item: any, index: number) => (
                  <div key={index} className="text-xs">
                    <span className="font-medium text-foreground">{item.word}</span>
                    <p className="text-muted-foreground">{item.definition}</p>
                  </div>
                ))}
              </div>

              <Separator className="my-3" />

              <div className="space-y-2">
                {project.grammar?.slice(0, 3).map((item: any, index: number) => (
                  <div key={index} className="text-xs">
                    <span className="font-medium text-foreground">{item.rule}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

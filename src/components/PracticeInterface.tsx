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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Reference Panel */}
      <div className="lg:col-span-1">
        <Card className="lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              {/* Vocabulary Section */}
              <div className="mb-6">
                <h4 className="font-semibold text-sm text-muted-foreground mb-3">VOCABULARY</h4>
                <div className="space-y-2">
                  {project.vocabulary?.map((item: any, index: number) => (
                    <div key={index} className="text-xs">
                      <span className="font-medium text-foreground">{item.word}</span>
                      <p className="text-muted-foreground">{item.definition}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Grammar Section */}
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-3">GRAMMAR</h4>
                <div className="space-y-3">
                  {project.grammar?.map((item: any, index: number) => (
                    <div key={index} className="text-xs">
                      <span className="font-medium text-foreground">{item.rule}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Practice Sentences Panel */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                Practice Sentences
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={generateSentences}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Generate More
              </Button>
            </div>

            {/* Difficulty Filter */}
            <div className="flex gap-2 mt-4">
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
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
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
              <Card className="p-8 text-center bg-muted">
                <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                  {practiceSentences.length === 0 
                    ? 'No practice sentences yet'
                    : 'No sentences at this difficulty level'
                  }
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {practiceSentences.length === 0
                    ? 'Click "Generate More" to create practice sentences'
                    : 'Try a different difficulty level'
                  }
                </p>
                {practiceSentences.length === 0 && (
                  <Button onClick={generateSentences}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Generate Practice Sentences
                  </Button>
                )}
              </Card>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {filteredSentences.map((sentence, index) => (
                    <Card key={index} className="p-4 hover:shadow-md transition-shadow">
                      {/* Sentence Text with Pronunciation */}
                      <div className="flex items-start gap-3 mb-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0 mt-1"
                          onClick={() => speak(sentence.text)}
                          disabled={currentSpeaking === sentence.text}
                        >
                          <Volume2 className={`h-5 w-5 ${currentSpeaking === sentence.text ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                        </Button>
                        <div className="flex-1">
                          <p className="text-lg font-medium text-foreground mb-1">
                            {sentence.text}
                          </p>
                          <p className="text-sm text-muted-foreground italic">
                            {sentence.translation}
                          </p>
                        </div>
                      </div>

                      {/* Tags and Difficulty */}
                      <div className="flex flex-wrap gap-2 items-center">
                        <Badge className={getDifficultyColor(sentence.difficulty)} variant="outline">
                          {sentence.difficulty}
                        </Badge>
                        
                        {sentence.usedVocabulary.length > 0 && (
                          <>
                            <span className="text-xs text-muted-foreground">Uses:</span>
                            {sentence.usedVocabulary.map((word, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {word}
                              </Badge>
                            ))}
                          </>
                        )}
                        
                        {sentence.usedGrammar.length > 0 && (
                          <>
                            {sentence.usedGrammar.map((grammar, i) => (
                              <Badge key={i} className="text-xs bg-purple-100 text-purple-800 border-purple-200" variant="outline">
                                {grammar}
                              </Badge>
                            ))}
                          </>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

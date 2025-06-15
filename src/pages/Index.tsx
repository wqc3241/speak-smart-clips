import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { VideoPreview } from "@/components/VideoPreview";
import { ScriptDisplay } from "@/components/ScriptDisplay";
import { VocabularyPanel } from "@/components/VocabularyPanel";
import { ConversationInterface } from "@/components/ConversationInterface";
import { ProjectManager } from "@/components/ProjectManager";
import { Youtube, BookOpen, MessageCircle, Save, History, TestTube } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [currentProject, setCurrentProject] = useState(null);
  const [activeTab, setActiveTab] = useState('input');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  };

  const fetchTranscript = async (videoId: string) => {
    try {
      console.log('Fetching transcript for video ID:', videoId);
      
      const { data, error } = await supabase.functions.invoke('extract-transcript', {
        body: { videoId }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to extract transcript');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to extract transcript');
      }

      return {
        transcript: data.transcript,
        videoTitle: data.videoTitle,
        captionsAvailable: data.captionsAvailable
      };
      
    } catch (error) {
      console.error('Error fetching transcript:', error);
      throw new Error(error.message || 'Could not extract transcript from this video');
    }
  };

  const analyzeContent = (script: string) => {
    // Enhanced content analysis - in a real app, this could use NLP services
    const words = script.toLowerCase().split(/\s+/);
    const uniqueWords = [...new Set(words)].filter(word => word.length > 3);
    
    // Generate vocabulary based on actual content
    const vocabulary = uniqueWords.slice(0, 10).map(word => ({
      word: word.replace(/[^\w]/g, ''),
      definition: `Definition for "${word}" - this would come from a dictionary API`,
      difficulty: Math.random() > 0.6 ? 'advanced' : Math.random() > 0.3 ? 'intermediate' : 'beginner'
    }));
    
    const grammar = [
      { rule: "Present Perfect", example: "has been", explanation: "Used for actions continuing to present" },
      { rule: "Past Simple", example: "was/were", explanation: "Used for completed actions in the past" },
      { rule: "Modal Verbs", example: "can/could/would", explanation: "Express possibility, ability, or permission" }
    ];
    
    return { vocabulary, grammar };
  };

  const testAPIs = async () => {
    setIsTesting(true);
    try {
      console.log('Testing APIs...');
      
      const { data, error } = await supabase.functions.invoke('test-apis', {
        body: { testType: 'both' }
      });

      if (error) {
        console.error('API test error:', error);
        throw new Error(error.message || 'Failed to test APIs');
      }

      console.log('API test results:', data);
      
      if (data.success) {
        toast({
          title: "✅ All APIs Working!",
          description: `YouTube: ${data.youtube.success ? '✅' : '❌'} | OpenAI: ${data.openai.success ? '✅' : '❌'}`,
        });
      } else {
        const issues = [];
        if (!data.youtube.success) issues.push(`YouTube: ${data.youtube.error}`);
        if (!data.openai.success) issues.push(`OpenAI: ${data.openai.error}`);
        
        toast({
          title: "❌ API Issues Found",
          description: issues.join(' | '),
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error('API testing failed:', error);
      toast({
        title: "Testing failed",
        description: error.message || "Could not test APIs",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!youtubeUrl) {
      toast({
        title: "Please enter a YouTube URL",
        variant: "destructive",
      });
      return;
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      toast({
        title: "Invalid YouTube URL",
        description: "Please enter a valid YouTube video URL",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log('Processing YouTube URL:', youtubeUrl);
      
      const { transcript, videoTitle } = await fetchTranscript(videoId);
      const { vocabulary, grammar } = analyzeContent(transcript);
      
      const project = {
        id: Date.now(),
        title: videoTitle || `Video Lesson - ${videoId}`,
        url: youtubeUrl,
        script: transcript,
        vocabulary: vocabulary,
        grammar: grammar
      };
      
      setCurrentProject(project);
      setActiveTab('lesson');
      
      toast({
        title: "Video processed successfully!",
        description: "Your lesson is ready for study.",
      });
      
    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: "Processing failed",
        description: error.message || "Could not process the video",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Language Learning Studio
          </h1>
          <p className="text-lg text-gray-600">
            Transform YouTube videos into interactive language lessons
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="input" className="flex items-center gap-2">
              <Youtube className="w-4 h-4" />
              Video Input
            </TabsTrigger>
            <TabsTrigger value="lesson" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Study
            </TabsTrigger>
            <TabsTrigger value="conversation" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Practice
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Projects
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="space-y-6">
            <Card className="w-full max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Youtube className="w-5 h-5 text-red-500" />
                  Add YouTube Video
                </CardTitle>
                <CardDescription>
                  Paste a YouTube URL to create a new language lesson
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="text-lg"
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={handleUrlSubmit} 
                    className="flex-1" 
                    size="lg"
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Processing Video...' : 'Process Video'}
                  </Button>
                  <Button 
                    onClick={testAPIs} 
                    variant="outline"
                    size="lg"
                    disabled={isTesting}
                    className="flex items-center gap-2"
                  >
                    <TestTube className="w-4 h-4" />
                    {isTesting ? 'Testing...' : 'Test APIs'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {youtubeUrl && (
              <VideoPreview url={youtubeUrl} />
            )}
          </TabsContent>

          <TabsContent value="lesson" className="space-y-6">
            {currentProject ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <ScriptDisplay script={currentProject.script} />
                  <Button className="w-full" variant="outline">
                    <Save className="w-4 h-4 mr-2" />
                    Save Project
                  </Button>
                </div>
                <div className="space-y-4">
                  <VocabularyPanel 
                    vocabulary={currentProject.vocabulary}
                    grammar={currentProject.grammar}
                  />
                </div>
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <BookOpen className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">
                    No lesson selected
                  </h3>
                  <p className="text-gray-500">
                    Process a YouTube video to start studying
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="conversation" className="space-y-6">
            {currentProject ? (
              <ConversationInterface project={currentProject} />
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <MessageCircle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">
                    No conversation available
                  </h3>
                  <p className="text-gray-500">
                    Complete a lesson to start practicing
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            <ProjectManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;

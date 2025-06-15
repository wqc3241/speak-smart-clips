
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
import { Youtube, BookOpen, MessageCircle, Save, History } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [currentProject, setCurrentProject] = useState(null);
  const [activeTab, setActiveTab] = useState('input');
  const { toast } = useToast();

  const handleUrlSubmit = async () => {
    if (!youtubeUrl) {
      toast({
        title: "Please enter a YouTube URL",
        variant: "destructive",
      });
      return;
    }

    console.log('Processing YouTube URL:', youtubeUrl);
    // Simulate processing
    setTimeout(() => {
      setCurrentProject({
        id: Date.now(),
        title: "Sample Video Lesson",
        url: youtubeUrl,
        script: "Welcome to this amazing video about language learning. Today we'll explore new vocabulary and grammar structures that will help you improve your fluency.",
        vocabulary: [
          { word: "amazing", definition: "extremely impressive or surprising", difficulty: "intermediate" },
          { word: "explore", definition: "to investigate or study", difficulty: "beginner" },
          { word: "fluency", definition: "ability to speak smoothly and easily", difficulty: "advanced" }
        ],
        grammar: [
          { rule: "Present Perfect", example: "We'll explore new vocabulary", explanation: "Used for actions that continue to the present" },
          { rule: "Modal Verbs", example: "will help you improve", explanation: "Express possibility, ability, or obligation" }
        ]
      });
      setActiveTab('lesson');
      toast({
        title: "Video processed successfully!",
        description: "Your lesson is ready for study.",
      });
    }, 2000);
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
                <Button 
                  onClick={handleUrlSubmit} 
                  className="w-full" 
                  size="lg"
                >
                  Process Video
                </Button>
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

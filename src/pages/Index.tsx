import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Youtube, BookOpen, MessageCircle, History, Loader2, Mic, MoreHorizontal, GraduationCap } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useVideoProcessing } from "@/hooks/useVideoProcessing";
import { useProject } from "@/hooks/useProject";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Header } from "@/components/dashboard/Header";
import { InputTab } from "@/components/dashboard/InputTab";
import { StudyTab } from "@/components/dashboard/StudyTab";
import { PracticeInterface } from "@/components/features/practice/PracticeInterface";
import { ProjectManager } from "@/components/features/project/ProjectManager";
import { TalkTab } from "@/components/features/conversation/TalkTab";
import { LearningPath } from "@/components/features/learning/LearningPath";
import { OnboardingGuide } from "@/components/features/onboarding/OnboardingGuide";
import { supabase } from "@/integrations/supabase/client";
import { TEST_TRANSCRIPT, TEST_VIDEO_TITLE, TEST_VIDEO_URL } from "@/lib/constants";
import type { AppProject, PracticeSentence } from "@/types/project";

const Index = () => {
  const [activeTab, setActiveTab] = useState('input');
  const [defaultTabResolved, setDefaultTabResolved] = useState(false);
  const navigate = useNavigate();
  const { user, isCheckingAuth, handleLogout } = useAuth();

  useEffect(() => {
    if (!isCheckingAuth && !user) {
      navigate("/auth", { replace: true });
    }
  }, [isCheckingAuth, user, navigate]);

  // Set default tab: 'learn' if user has projects, 'input' for new users
  useEffect(() => {
    if (!user || defaultTabResolved) return;
    const checkProjects = async () => {
      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (count && count > 0) {
        setActiveTab('learn');
      }
      setDefaultTabResolved(true);
    };
    checkProjects();
  }, [user, defaultTabResolved]);
  const {
    isProcessing,
    processingStep,
    setProcessingStep,
    setIsProcessing,
    processVideo,
    regenerateAnalysis,
    analyzeContentWithAI,
    generatePracticeSentences,
  } = useVideoProcessing();
  const { currentProject, setCurrentProject, autoSaveProject } = useProject(user);
  const { toast } = useToast();

  const handleProjectCreated = (project: AppProject) => {
    setCurrentProject(project);
    setActiveTab('lesson');
  };

  const handleUseTestData = async () => {
    setIsProcessing(true);

    try {
      setProcessingStep('Loading test transcript...');
      toast({
        title: "Loading test data",
        description: "Analyzing Japanese tennis racket video...",
      });

      // Use hardcoded transcript
      const transcript = TEST_TRANSCRIPT;

      // Still call AI analysis to test the analyze-content function
      setProcessingStep('Analyzing content with AI...');
      const { vocabulary, grammar, detectedLanguage } = await analyzeContentWithAI(transcript);

      // Generate practice sentences automatically
      setProcessingStep('Generating practice sentences...');
      const practiceSentences = await generatePracticeSentences(vocabulary, grammar, detectedLanguage);

      const project = {
        id: Date.now(),
        title: TEST_VIDEO_TITLE,
        url: TEST_VIDEO_URL,
        script: transcript,
        vocabulary: vocabulary,
        grammar: grammar,
        detectedLanguage: detectedLanguage,
        practiceSentences: practiceSentences
      };

      setCurrentProject(project);
      setActiveTab('lesson');
      setProcessingStep('');

      toast({
        title: "Test data loaded successfully!",
        description: `Your lesson is ready for study. Language: ${detectedLanguage}`,
      });

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not load test data";
      console.error('Test data loading error:', error);
      setProcessingStep('');
      toast({
        title: "Loading failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerUnitGeneration = async (projectUrl: string) => {
    if (!user?.id) return;
    try {
      const { data: saved } = await supabase.from('projects').select('id')
        .eq('youtube_url', projectUrl).eq('user_id', user.id).single();
      if (saved?.id) {
        supabase.functions.invoke('generate-learning-units', { body: { projectId: saved.id } })
          .catch(console.error);
      }
    } catch (e) { console.error('Unit generation trigger error:', e); }
  };

  const handleProcessVideo = async (videoId: string, languageCode?: string, selectedLanguageName?: string) => {
    const project = await processVideo(videoId, languageCode, selectedLanguageName, user?.id, async (updatedProject) => {
      // This callback is called when a pending project completes
      setCurrentProject((prev) =>
        prev?.jobId === updatedProject.jobId ? updatedProject : prev
      );
      if (updatedProject.status === 'completed') {
        triggerUnitGeneration(updatedProject.url);
      }
    });
    if (project) {
      handleProjectCreated(project);
      await autoSaveProject(project);

      if (project.status === 'completed') {
        triggerUnitGeneration(project.url);
      }
    }
  };

  const handleRegenerateAnalysis = async () => {
    const updatedProject = await regenerateAnalysis(currentProject);
    if (updatedProject) {
      setCurrentProject(updatedProject);
    }
  };

  const loadProject = (project: AppProject) => {
    setCurrentProject(project);
    setActiveTab('lesson');
    toast({
      title: "Project loaded",
      description: "Switched to Study tab",
    });
  };

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <OnboardingGuide />
      <Header user={user} onLogout={handleLogout} />

      <main className="container mx-auto px-4 py-6 md:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="md:grid md:grid-cols-[240px_minmax(0,1fr)] md:gap-6 lg:gap-8">
            <aside className="hidden md:block">
              <div className="sticky top-24 space-y-4">
                <TabsList className="grid h-auto grid-cols-1 gap-1 bg-muted/70 p-1">
                  <TabsTrigger value="input" className="justify-start gap-2">
                    <Youtube className="w-4 h-4" />
                    <span>Search</span>
                  </TabsTrigger>
                  <TabsTrigger value="learn" className="justify-start gap-2">
                    <GraduationCap className="w-4 h-4" />
                    <span>Learn</span>
                  </TabsTrigger>
                  <TabsTrigger value="lesson" className="justify-start gap-2">
                    <BookOpen className="w-4 h-4" />
                    <span>Study</span>
                  </TabsTrigger>
                  <TabsTrigger value="conversation" className="justify-start gap-2">
                    <MessageCircle className="w-4 h-4" />
                    <span>Practice</span>
                  </TabsTrigger>
                  <TabsTrigger value="talk" className="justify-start gap-2">
                    <Mic className="w-4 h-4" />
                    <span>Talk</span>
                  </TabsTrigger>
                  <TabsTrigger value="projects" className="justify-start gap-2">
                    <History className="w-4 h-4" />
                    <span>Projects</span>
                  </TabsTrigger>
                </TabsList>

                <Card className="border-dashed">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Current lesson</p>
                    <p className="text-sm font-medium line-clamp-2">
                      {currentProject?.title || "No lesson selected"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {currentProject?.status === 'pending'
                        ? 'Transcript generation in progress'
                        : currentProject?.status === 'failed'
                          ? 'Last generation failed'
                          : currentProject
                            ? 'Ready to study and practice'
                            : 'Add a video from Input tab to start'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </aside>

            <div className="min-w-0">
              <TabsContent value="input" className="mt-0">
                <ErrorBoundary>
                  <InputTab
                    isProcessing={isProcessing}
                    processingStep={processingStep}
                    onProcessVideo={handleProcessVideo}
                    onUseTestData={handleUseTestData}
                  />
                </ErrorBoundary>
              </TabsContent>

              <TabsContent value="learn" className="mt-0">
                <ErrorBoundary>
                  <LearningPath />
                </ErrorBoundary>
              </TabsContent>

              <TabsContent value="lesson" className="mt-0">
                <ErrorBoundary>
                  <StudyTab
                    currentProject={currentProject}
                    isProcessing={isProcessing}
                    processingStep={processingStep}
                    onUpdateProject={setCurrentProject}
                    onRegenerateAnalysis={handleRegenerateAnalysis}
                  />
                </ErrorBoundary>
              </TabsContent>

              <TabsContent value="conversation" className="mt-0 space-y-4 md:space-y-6">
                <ErrorBoundary>
                  {currentProject ? (
                    <PracticeInterface
                      project={currentProject}
                      onSentencesUpdate={(sentences) => {
                        setCurrentProject((prev: AppProject | null) =>
                          prev ? { ...prev, practiceSentences: sentences as PracticeSentence[] } : null
                        );
                      }}
                    />
                  ) : (
                    <Card className="text-center py-16 border-none shadow-none">
                      <CardContent>
                        <MessageCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                          No lesson to practice
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Complete a lesson first
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </ErrorBoundary>
              </TabsContent>

              <TabsContent value="talk" className="mt-0 space-y-4 md:space-y-6">
                <ErrorBoundary>
                  <TalkTab />
                </ErrorBoundary>
              </TabsContent>

              <TabsContent value="projects" className="mt-0 space-y-4 md:space-y-6">
                <ErrorBoundary>
                  <ProjectManager onLoadProject={loadProject} />
                </ErrorBoundary>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-20">
        <div className="grid grid-cols-4">
          <button
            aria-label="Search tab"
            onClick={() => setActiveTab('input')}
            className={`flex flex-col items-center gap-1 py-3 ${activeTab === 'input' ? 'text-primary' : 'text-muted-foreground'
              }`}
          >
            <Youtube className="w-5 h-5" />
            <span className="text-xs">Search</span>
          </button>
          <button
            aria-label="Learn tab"
            onClick={() => setActiveTab('learn')}
            className={`flex flex-col items-center gap-1 py-3 ${activeTab === 'learn' ? 'text-primary' : 'text-muted-foreground'
              }`}
          >
            <GraduationCap className="w-5 h-5" />
            <span className="text-xs">Learn</span>
          </button>
          <button
            aria-label="Talk tab"
            onClick={() => setActiveTab('talk')}
            className={`flex flex-col items-center gap-1 py-3 ${activeTab === 'talk' ? 'text-primary' : 'text-muted-foreground'
              }`}
          >
            <Mic className="w-5 h-5" />
            <span className="text-xs">Talk</span>
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button
                aria-label="More options"
                className={`flex flex-col items-center gap-1 py-3 ${['lesson', 'conversation', 'projects'].includes(activeTab) ? 'text-primary' : 'text-muted-foreground'
                  }`}
              >
                <MoreHorizontal className="w-5 h-5" />
                <span className="text-xs">More</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="w-48 p-1 mb-1">
              <button
                onClick={() => setActiveTab('lesson')}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm ${activeTab === 'lesson' ? 'text-primary bg-primary/10' : 'text-foreground hover:bg-muted'
                  }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Study</span>
              </button>
              <button
                onClick={() => setActiveTab('conversation')}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm ${activeTab === 'conversation' ? 'text-primary bg-primary/10' : 'text-foreground hover:bg-muted'
                  }`}
              >
                <MessageCircle className="w-4 h-4" />
                <span>Practice</span>
              </button>
              <button
                onClick={() => setActiveTab('projects')}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm ${activeTab === 'projects' ? 'text-primary bg-primary/10' : 'text-foreground hover:bg-muted'
                  }`}
              >
                <History className="w-4 h-4" />
                <span>Projects</span>
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </nav>
    </div>
  );
};

export default Index;

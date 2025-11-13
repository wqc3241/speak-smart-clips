import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoPreview } from "@/components/VideoPreview";
import { ScriptDisplay } from "@/components/ScriptDisplay";
import { VocabularyPanel } from "@/components/VocabularyPanel";
import { PracticeInterface } from "@/components/PracticeInterface";
import { ProjectManager } from "@/components/ProjectManager";
import { Youtube, BookOpen, MessageCircle, Save, History, Beaker, Loader2, LogOut, User as UserIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { YoutubeTranscript } from 'youtube-transcript';
import { User, Session } from '@supabase/supabase-js';

// Test data for development - Japanese tennis racket video transcript
const TEST_TRANSCRIPT = `おはようございます。え、ウィンザーラケスチョップ渋谷店の斎藤です。 おはようございます。ナビゲーターの三葉です。本日の一押しは はい、 こちらのバボラのタッチトニックタッチニック 高級な糸と思いますよね。そこを調子していきたいと思います。 はい。ではやっていきたいと思います。よろしくお願いします。 一押し [音楽] 重さ、バランス、スイングウェイトを瞬時 に測れる機械になります。こちらは ウィンザー前点に配置されている機械と なっております。複数本ラケットを持ち たい方ですとか、重さバランスを気にされ ている方に計測しています。ガットが切れ てしまった時にもう1本あると安心ですし 、試合の多い時期にガトが切れてしまった 時には、え、2本3本あるとも安心すると 思います。ラケットはカタログにも重さは 書いてあるんですけれども、どうしても 個体さがありますので、ウィンザーでは 豊富な在庫があります。ご希望に沿った 近いラケットをお探しすることができます ので、是非スタッフにお声かけをして ください。皆様のご来店をお待ちしており ます。 では最さんやっていきたいと思いますが、本日の一押しは はい。 バボラのタッチニック。 タッチです。 はい。こちらどんな商品でしょうか? はい。で、ま、まずナチュラルガットって言われるとやっぱりお客様によく言われるのがやっぱり値段が高いからなかなか手が出せない と言われてる中でバボラが出している、ま、入門用のナチュラルストリングと言われるストリン。ただ入門用だからって言ってもそのままずっと使い続ける方もいらっしゃいます。 なので、ま、ナチュラルの中で行けば、ま、安い方。ただ内の糸もいれば、まあまあ 1番高いところぐらいになる。 そうですね。 イメージですね。 はい。で、えっと、一応タッチトニックっていうストリングには、ま、 2種類ゲージがありまして、この 1.35 よりちょっと細い感じで金性がないものと、ま、 1.35 以上と書かれてるもの、昔は、え、ボールフィールって言われた、こっちらロンジビティって言われたようにこういったちょっと 2種類のゲージが出てます。すいません。 今おっしゃいました金性がないとおっしゃったんですけども、それは加工上ということですね。 そうですね。 があるので、ちょっと、ま、少しお値段はお買い求めやすくなってますよ。でも質は十分いいものでっていうのが作、今おっしゃったように太さが違う。ま、やっぱ天然素材を使っているので、え、太い部分もあれば細い部分もあるということなんですが、ただ一定レンジの中に収まっているので、 これテンションかけて貼っちゃえば うん。 あんまり関係ないというか、均質になっちゃうと思うんですけどね。 そうですね。はい。そして ナイロンのストリンクスの中では、ま、やっぱり 1番圧倒的にってあるのはこの X1倍です。 で、こちらも当然反発性も高く、ま、このナチュラルガットを目指して作ってるっていうところも、ま、それを超えるつもりで作ってるところもあるのですごくいいソリングで人気はあるんですけど、やっぱりでもそのナチュラルのテンション性、単発性にはなかなか 勝負してくのは難しいかなと思います。 私も個人的にちょっと調べたんですよ、色々。 そうするとこの2 つって割と柔らかいように言われるじゃないですか。ただ結構しっかりしてて、えっと、ロンよりもやっぱり共同的にはしっかりしてるんですよね。そういう意味では非常に近しいテクニファイバーがエクサバイフのナチュラルを目指して作ったのもすごく頷付ける。うん。はい。 ただでもやっぱ天然物にというとこもあるんですかね。そうですね。 で、あの、皆さんこうじゃ、ナチュラルにしようかなと思った時にちょっとらうところていうのがまず 1つがこう雨にうん。 よく言われますね。 はい。 濡れちゃうとナチュラルって使えないんでしょって言われるんですけど、それはもうロンのスリンスについても濡れたら質はもう一気にガクっと落ちます。 たそういった水性っていうところはそれほど差がないですし、コーティングはもうバボランのナチュラルっていうもコーティングは昔と比べればかなり変わってるのでそこまで ナチュラルだけが全然水性に弱いってことはないと思うので、ま、同じように使っていただいていいかなと思う。 うん。 はい。 そういう意味では、ま、雨の日 そんな気にしなくてもというところですね。 そうですね。そしてもう1 個やっぱり値段がナチュラルの方がやっぱり圧倒的に高いでしょって言われてしまうんですけど、 実際今これ2つあるんですけど、えっと はい。 ストリングの価格 はい。 テクニファイバーX3倍フェガユと 4730円 はい。4730 円というのが、ま、ガッツの、ま、元々のお値段 でナチュラルタッチソニック はい。 7590円 ていうお値段が元々のストに出た。 ただタチトニックって張り上がりの価格っていうのはガットの価格よりも逆に安いんですよ。どういうことでしょう? お買読になってます。 なるほど。お はい。 どうしても ここの差って15600円。 ああ、なるほどなるほどなるほど。 だったらナチュラルをね、貼ってもいいんじゃないかっていう。 そう。パットとしては3000 円ぐらいお値段が高いものなのに 1500 円ぐらいしか貼り上がれる値段さもないので是非このナチュラルっていうのをもうちょっと身近に感じて試していただきたいかなと。 そうですね。 ま、ナチュラル打ったことない方って売られるんですかね? うん。結構いらっしゃいますよ。 売られますよね。やっぱり 1 度打つと、ま、天然物って言われるものの良さってやっぱりあるんだなって感じますもんね。 そうですね。で、やっぱり1 度ナチュラルス使い出すともうそのままずっと使い続ける方も多いので、ま、新しいラケットをご購入いただい時もそのまま差額でタチラルは貼るっていう方が多いです。 [音楽] はい。 うん。ま、これからね、12 月に向けてボーナスシーズンでもありますから、ちょっとね、 1 回こう贅沢してみようかなという気分で貼っていただいて、 ま、抜けれなくなる場合もありますけど、ま、戻すことはできるので、ま、毎月ね、切れるとかっていうことはそれほどない方が多いと思うので、そういう方にとっては 3 ヶ月半年の張り替えとして是非テンション性の高い、カンパ通力の高いこのタッチニックを試していただきたいと思います。 はい。ということで今日いいた一押しは はい。 バオラのナチュラルスリングタッチトニックを一させていただきました。 はい、是非の機会お試しください。さん、ありがとうございました。 はい、ありがとうございます。`;

const TEST_VIDEO_TITLE = "Tennis Racket Review - Babolat Touch Tonic Natural String";
const TEST_VIDEO_URL = "https://www.youtube.com/watch?v=test_sample_123";

const Index = () => {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [currentProject, setCurrentProject] = useState(null);
  const [activeTab, setActiveTab] = useState('input');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [pendingVideoId, setPendingVideoId] = useState<string>('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const { toast } = useToast();

  // Auth state management
  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          // Not logged in - redirect immediately
          window.location.href = '/auth';
          return;
        }
        
        // Logged in - show content
        setIsCheckingAuth(false);
      } catch (error) {
        console.error('Auth check error:', error);
        if (mounted) {
          setIsCheckingAuth(false);
          window.location.href = '/auth';
        }
      }
    };

    // Set up auth state listener for future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session && !isCheckingAuth) {
          window.location.href = '/auth';
        }
      }
    );

    checkAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  };

  const fetchAvailableLanguages = async (videoId: string) => {
    try {
      console.log('Fetching available languages for:', videoId);
      const { data, error } = await supabase.functions.invoke('get-available-languages', {
        body: { videoId }
      });
      
      if (error || !data?.success) {
        console.warn('Could not fetch languages, proceeding with auto-detection');
        return null;
      }
      
      return data.availableLanguages || [];
    } catch (error) {
      console.error('Error fetching languages:', error);
      return null;
    }
  };

  const fetchTranscript = async (videoId: string, languageCode?: string) => {
    // 1) Try server-side extract-transcript first (most reliable)
    try {
      console.log('Trying extract-transcript edge function for:', videoId, 'language:', languageCode || 'auto');
      const { data, error } = await supabase.functions.invoke('extract-transcript', {
        body: { videoId, languageCode }
      });
      if (!error && data?.success && data.transcript) {
        console.log('✓ Successfully extracted transcript via extract-transcript');
        return {
          transcript: data.transcript,
          videoTitle: data.videoTitle || `Video Lesson - ${videoId}`,
          captionsAvailable: data.captionsAvailable || false,
        };
      }

      // If transcript is too short, throw immediately with user-friendly message
      if (data?.error && data.error.includes('more than 50 words')) {
        throw new Error(data.error);
      }

      console.warn('extract-transcript failed or returned no transcript:', data?.error);
    } catch (err) {
      console.warn('extract-transcript edge function failed:', err);
    }

    // 2) Fallback: Whisper-only edge function (audio transcription)
    try {
      console.log('Trying whisper-transcribe fallback for:', videoId);
      const { data, error } = await supabase.functions.invoke('whisper-transcribe', {
        body: { videoId }
      });
      if (error) throw new Error(error.message || 'Failed to transcribe audio');
      if (!data.success) throw new Error(data.error || 'Failed to transcribe audio');
      console.log('✓ Successfully transcribed audio via whisper-transcribe');
      return {
        transcript: data.transcript,
        videoTitle: data.videoTitle,
        captionsAvailable: false,
      };
    } catch (error: any) {
      console.warn('whisper-transcribe failed:', error);
    }

    // 3) Last resort: Try client-side transcript (limited by CORS)
    try {
      console.log('Trying client-side youtube-transcript for:', videoId);
      let segments: any[] | null = null;
      try {
        segments = await (YoutubeTranscript as any).fetchTranscript(videoId, { lang: 'en' });
      } catch (e) {
        // Fallback to any available language
        segments = await (YoutubeTranscript as any).fetchTranscript(videoId);
      }

      if (segments && segments.length) {
        const transcript = segments.map((s: any) => s.text).join(' ');
        let videoTitle = `Video Lesson - ${videoId}`;
        try {
          const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
          if (res.ok) {
            const meta = await res.json();
            if (meta.title) videoTitle = meta.title;
          }
        } catch (e) {
          console.warn('Title fetch failed, using default.', e);
        }
        console.log('✓ Successfully extracted transcript via client-side youtube-transcript');
        return { transcript, videoTitle, captionsAvailable: true };
      }
    } catch (err) {
      console.warn('youtube-transcript failed:', err);
    }

    console.error('All transcript extraction methods failed for video:', videoId);
    throw new Error('Could not extract transcript. Please ensure the video has captions available and try again.');
  };

  const analyzeContentWithAI = async (script: string) => {
    try {
      console.log('Analyzing content with AI...');
      
      const { data, error } = await supabase.functions.invoke('analyze-content', {
        body: { transcript: script }
      });

      if (error) {
        console.error('AI analysis error:', error);
        throw error;
      }

      console.log('AI analysis result:', data);
      
      return {
        vocabulary: data.vocabulary || [],
        grammar: data.grammar || [],
        detectedLanguage: data.detectedLanguage || 'Unknown'
      };
    } catch (error) {
      console.error('Failed to analyze content with AI:', error);
      // Return empty arrays if AI analysis fails
      return {
        vocabulary: [],
        grammar: [],
        detectedLanguage: 'Unknown'
      };
    }
  };

  const generatePracticeSentences = async (vocabulary: any[], grammar: any[], detectedLanguage: string) => {
    try {
      console.log('Generating practice sentences...');
      
      const { data, error } = await supabase.functions.invoke('generate-practice-sentences', {
        body: {
          vocabulary,
          grammar,
          detectedLanguage,
          count: 10
        }
      });

      if (error) {
        console.error('Error generating sentences:', error);
        return [];
      }

      if (data?.sentences && data.sentences.length > 0) {
        console.log('Generated practice sentences:', data.sentences.length);
        return data.sentences;
      }
      
      return [];
    } catch (error: any) {
      console.error('Failed to generate sentences:', error);
      return [];
    }
  };

  const saveCurrentProject = async () => {
    if (!currentProject) return;
    
    try {
      console.log('Saving project to database...');
      
      // Check if project with this URL already exists for this user
      const { data: existing, error: checkError } = await supabase
        .from('projects')
        .select('id, title')
        .eq('youtube_url', currentProject.url)
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      if (existing) {
        // Project already exists - update it
        const confirmUpdate = confirm(
          `A project with this YouTube video already exists: "${existing.title}". Do you want to update it?`
        );
        
        if (!confirmUpdate) {
          toast({
            title: "Save cancelled",
            description: "The existing project was not modified.",
          });
          return;
        }
        
        // Update existing project
        const { error: updateError } = await supabase
          .from('projects')
          .update({
            title: currentProject.title,
            script: currentProject.script,
            vocabulary: currentProject.vocabulary,
            grammar: currentProject.grammar,
            practice_sentences: currentProject.practiceSentences || [],
            detected_language: currentProject.detectedLanguage,
            last_accessed: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        
        if (updateError) throw updateError;
        
        toast({
          title: "Project updated!",
          description: "Your project has been updated successfully.",
        });
      } else {
        // New project - insert it
        const { error: insertError } = await supabase
          .from('projects')
          .insert({
            youtube_url: currentProject.url,
            title: currentProject.title,
            script: currentProject.script,
            vocabulary: currentProject.vocabulary,
            grammar: currentProject.grammar,
            practice_sentences: currentProject.practiceSentences || [],
            detected_language: currentProject.detectedLanguage,
            is_favorite: false,
            user_id: user?.id,
          });
        
        if (insertError) throw insertError;
        
        toast({
          title: "Project saved!",
          description: "Find it in the Projects tab.",
        });
      }
      
    } catch (error: any) {
      console.error('Failed to save project:', error);
      toast({
        title: "Save failed",
        description: error.message || "Could not save project",
        variant: "destructive",
      });
    }
  };

  const loadProject = (project: any) => {
    setCurrentProject(project);
    setActiveTab('lesson');
    toast({
      title: "Project loaded",
      description: "Switched to Study tab",
    });
  };

  const regenerateAnalysis = async () => {
    if (!currentProject) return;
    
    setIsProcessing(true);
    setProcessingStep('Re-analyzing content with AI...');
    
    try {
      console.log('Regenerating analysis with language:', currentProject.detectedLanguage);
      
      // Re-analyze content with the current detected language
      const { vocabulary, grammar, detectedLanguage } = await analyzeContentWithAI(currentProject.script);
      
      setProcessingStep('Generating practice sentences...');
      
      // Regenerate practice sentences
      const practiceSentences = await generatePracticeSentences(vocabulary, grammar, detectedLanguage);
      
      // Update current project
      setCurrentProject({
        ...currentProject,
        vocabulary,
        grammar,
        detectedLanguage,
        practiceSentences
      });
      
      setProcessingStep('');
      
      toast({
        title: "Analysis regenerated!",
        description: `Content re-analyzed as ${detectedLanguage}`,
      });
      
    } catch (error: any) {
      console.error('Failed to regenerate analysis:', error);
      toast({
        title: "Regeneration failed",
        description: error.message || "Could not regenerate analysis",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };


  const handleUseTestData = async () => {
    setIsProcessing(true);
    
    try {
      console.log('Using test data...');
      
      setProcessingStep('Loading test transcript...');
      toast({
        title: "Loading test data",
        description: "Analyzing Japanese tennis racket video...",
      });
      
      // Use hardcoded transcript
      const transcript = TEST_TRANSCRIPT;
      
      // Still call AI analysis to test the analyze-content function
      setProcessingStep('Analyzing content with AI...');
      console.log('Analyzing test content with AI...');
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
      
    } catch (error) {
      console.error('Test data loading error:', error);
      setProcessingStep('');
      toast({
        title: "Loading failed",
        description: error.message || "Could not load test data",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const continueProcessing = async (videoId: string, languageCode?: string) => {
    setIsProcessing(true);
    setProcessingStep('Extracting transcript...');
    setShowLanguageSelector(false);

    try {
      const { transcript, videoTitle } = await fetchTranscript(videoId, languageCode);
      
      setProcessingStep('Analyzing content with AI...');
      const { vocabulary, grammar } = await analyzeContentWithAI(transcript);
      
      setProcessingStep('Generating practice sentences...');
      const practiceSentences = await generatePracticeSentences(vocabulary, grammar, selectedLanguage);
      
      const project = {
        id: Date.now(),
        title: videoTitle || `Video Lesson - ${videoId}`,
        url: youtubeUrl,
        script: transcript,
        vocabulary,
        grammar,
        detectedLanguage: selectedLanguage,
        practiceSentences
      };
      
      setCurrentProject(project);
      setActiveTab('lesson');
      
      toast({
        title: "Video processed successfully!",
        description: `Your lesson is ready for study. Language: ${selectedLanguage}`,
      });
    } catch (error: any) {
      toast({
        title: "Processing failed",
        description: error.message || "Failed to process video",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
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

    // Show language selector immediately
    setPendingVideoId(videoId);
    setShowLanguageSelector(true);
    setSelectedLanguage('');
  };

  const handleLanguageSelected = async () => {
    if (!pendingVideoId || !selectedLanguage) return;
    
    setShowLanguageSelector(false);
    setIsProcessing(true);
    setProcessingStep('Extracting transcript...');
    
    try {
      // Map the language name to language code for transcript extraction
      const languageCodeMap: { [key: string]: string } = {
        'Japanese': 'ja',
        'Chinese': 'zh',
        'Korean': 'ko',
        'Spanish': 'es',
        'French': 'fr',
        'German': 'de',
        'Italian': 'it',
        'Portuguese': 'pt',
        'Russian': 'ru',
        'Arabic': 'ar',
        'Hindi': 'hi',
      };
      
      const languageCode = languageCodeMap[selectedLanguage];
      await continueProcessing(pendingVideoId, languageCode);
      
    } catch (error: any) {
      console.error('Processing error:', error);
      toast({
        title: "Processing failed",
        description: error.message || "Could not process the video",
        variant: "destructive",
      });
      setIsProcessing(false);
      setProcessingStep('');
    }
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
      {/* Header - Desktop only */}
      <header className="hidden md:block border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">
            Speak Smart Clips
          </h1>
          <p className="text-sm text-muted-foreground">
            Learn languages from YouTube videos
          </p>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden border-b bg-card sticky top-0 z-10 backdrop-blur">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-foreground">Speak Smart Clips</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 md:py-8">
        {/* User Header */}
        {user && (
          <div className="mb-4 flex items-center justify-between bg-card p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Desktop Tab Navigation */}
          <TabsList className="hidden md:grid w-full grid-cols-4 mb-6 bg-muted">
            <TabsTrigger value="input" className="gap-2">
              <Youtube className="w-4 h-4" />
              <span>Input</span>
            </TabsTrigger>
            <TabsTrigger value="lesson" className="gap-2">
              <BookOpen className="w-4 h-4" />
              <span>Study</span>
            </TabsTrigger>
            <TabsTrigger value="conversation" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              <span>Practice</span>
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <History className="w-4 h-4" />
              <span>Projects</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="space-y-4 md:space-y-6">
            <Card className="border-none shadow-none md:border md:shadow-sm">
              <CardHeader className="px-0 md:px-6">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Youtube className="w-5 h-5 text-primary" />
                  Add Video
                </CardTitle>
                <CardDescription>
                  Paste a YouTube URL to start learning
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-0 md:px-6">
                <Input
                  placeholder="YouTube video URL..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="h-12 text-base"
                />
                <Button 
                  onClick={handleUrlSubmit} 
                  className="w-full h-12 text-base" 
                  size="lg"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Youtube className="w-5 h-5 mr-2" />
                      Process Video
                    </>
                  )}
                </Button>
                
                {isProcessing && processingStep && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{processingStep}</span>
                  </div>
                )}
                
                <Button 
                  onClick={handleUseTestData} 
                  variant="outline"
                  size="sm"
                  disabled={isProcessing}
                  className="w-full gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Beaker className="w-4 h-4" />
                      See Demo
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Language Selection Dialog */}
            {showLanguageSelector && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle>Select Language</CardTitle>
                  <CardDescription>
                    Choose the language you want to learn from this video
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Select
                      value={selectedLanguage}
                      onValueChange={setSelectedLanguage}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Japanese">Japanese</SelectItem>
                        <SelectItem value="Chinese">Chinese (Mandarin)</SelectItem>
                        <SelectItem value="Korean">Korean</SelectItem>
                        <SelectItem value="Spanish">Spanish</SelectItem>
                        <SelectItem value="French">French</SelectItem>
                        <SelectItem value="German">German</SelectItem>
                        <SelectItem value="Italian">Italian</SelectItem>
                        <SelectItem value="Portuguese">Portuguese</SelectItem>
                        <SelectItem value="Russian">Russian</SelectItem>
                        <SelectItem value="Arabic">Arabic</SelectItem>
                        <SelectItem value="Hindi">Hindi</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={handleLanguageSelected}
                        disabled={!selectedLanguage}
                        className="flex-1"
                      >
                        Continue
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowLanguageSelector(false);
                          setSelectedLanguage('');
                          setPendingVideoId('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {youtubeUrl && !showLanguageSelector && (
              <VideoPreview url={youtubeUrl} />
            )}
          </TabsContent>

          <TabsContent value="lesson" className="space-y-4 md:space-y-6">
            {currentProject ? (
              <div className="space-y-4">
                {/* Save Button - Top on mobile */}
                <Button className="w-full md:hidden" onClick={saveCurrentProject}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Project
                </Button>

                {/* Language Selector */}
                {currentProject.detectedLanguage && (
                  <Card className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Detected language:</span>
                        <Select 
                          value={currentProject.detectedLanguage} 
                          onValueChange={(value) => {
                            setCurrentProject({
                              ...currentProject,
                              detectedLanguage: value
                            });
                            toast({
                              title: "Language updated",
                              description: `Changed to ${value}. Click "Regenerate" to re-analyze.`
                            });
                          }}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Japanese">Japanese</SelectItem>
                            <SelectItem value="Chinese">Chinese (Mandarin)</SelectItem>
                            <SelectItem value="Korean">Korean</SelectItem>
                            <SelectItem value="Spanish">Spanish</SelectItem>
                            <SelectItem value="French">French</SelectItem>
                            <SelectItem value="German">German</SelectItem>
                            <SelectItem value="Italian">Italian</SelectItem>
                            <SelectItem value="Portuguese">Portuguese</SelectItem>
                            <SelectItem value="Russian">Russian</SelectItem>
                            <SelectItem value="Arabic">Arabic</SelectItem>
                            <SelectItem value="Hindi">Hindi</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={regenerateAnalysis}
                        disabled={isProcessing}
                        className="w-full sm:w-auto"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Regenerating...
                          </>
                        ) : (
                          'Regenerate Analysis'
                        )}
                      </Button>
                    </div>
                    {isProcessing && processingStep && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3 animate-fade-in">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{processingStep}</span>
                      </div>
                    )}
                  </Card>
                )}

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-4">
                    <ScriptDisplay script={currentProject.script} />
                    <Button className="w-full hidden md:flex" variant="outline" onClick={saveCurrentProject}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Project
                    </Button>
                  </div>
                  <VocabularyPanel 
                    vocabulary={currentProject.vocabulary} 
                    grammar={currentProject.grammar}
                    detectedLanguage={currentProject.detectedLanguage}
                  />
                </div>
              </div>
            ) : (
              <Card className="text-center py-16 border-none shadow-none">
                <CardContent>
                  <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                    No lesson yet
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Add a YouTube video to start learning
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="conversation" className="space-y-4 md:space-y-6">
            {currentProject ? (
              <PracticeInterface 
                project={currentProject} 
                onSentencesUpdate={(sentences) => {
                  setCurrentProject(prev => prev ? {...prev, practiceSentences: sentences} : null);
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
          </TabsContent>

          <TabsContent value="projects" className="space-y-4 md:space-y-6">
            <ProjectManager onLoadProject={loadProject} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-20">
        <div className="grid grid-cols-4">
          <button
            onClick={() => setActiveTab('input')}
            className={`flex flex-col items-center gap-1 py-3 ${
              activeTab === 'input' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Youtube className="w-5 h-5" />
            <span className="text-xs">Input</span>
          </button>
          <button
            onClick={() => setActiveTab('lesson')}
            className={`flex flex-col items-center gap-1 py-3 ${
              activeTab === 'lesson' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-xs">Study</span>
          </button>
          <button
            onClick={() => setActiveTab('conversation')}
            className={`flex flex-col items-center gap-1 py-3 ${
              activeTab === 'conversation' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs">Practice</span>
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex flex-col items-center gap-1 py-3 ${
              activeTab === 'projects' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <History className="w-5 h-5" />
            <span className="text-xs">Projects</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Index;

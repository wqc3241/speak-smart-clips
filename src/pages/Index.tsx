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
import { PracticeInterface } from "@/components/PracticeInterface";
import { ProjectManager } from "@/components/ProjectManager";
import { Youtube, BookOpen, MessageCircle, Save, History, TestTube, Beaker } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { YoutubeTranscript } from 'youtube-transcript';

// Test data for development - Japanese tennis racket video transcript
const TEST_TRANSCRIPT = `おはようございます。え、ウィンザーラケスチョップ渋谷店の斎藤です。 おはようございます。ナビゲーターの三葉です。本日の一押しは はい、 こちらのバボラのタッチトニックタッチニック 高級な糸と思いますよね。そこを調子していきたいと思います。 はい。ではやっていきたいと思います。よろしくお願いします。 一押し [音楽] 重さ、バランス、スイングウェイトを瞬時 に測れる機械になります。こちらは ウィンザー前点に配置されている機械と なっております。複数本ラケットを持ち たい方ですとか、重さバランスを気にされ ている方に計測しています。ガットが切れ てしまった時にもう1本あると安心ですし 、試合の多い時期にガトが切れてしまった 時には、え、2本3本あるとも安心すると 思います。ラケットはカタログにも重さは 書いてあるんですけれども、どうしても 個体さがありますので、ウィンザーでは 豊富な在庫があります。ご希望に沿った 近いラケットをお探しすることができます ので、是非スタッフにお声かけをして ください。皆様のご来店をお待ちしており ます。 では最さんやっていきたいと思いますが、本日の一押しは はい。 バボラのタッチニック。 タッチです。 はい。こちらどんな商品でしょうか? はい。で、ま、まずナチュラルガットって言われるとやっぱりお客様によく言われるのがやっぱり値段が高いからなかなか手が出せない と言われてる中でバボラが出している、ま、入門用のナチュラルストリングと言われるストリン。ただ入門用だからって言ってもそのままずっと使い続ける方もいらっしゃいます。 なので、ま、ナチュラルの中で行けば、ま、安い方。ただ内の糸もいれば、まあまあ 1番高いところぐらいになる。 そうですね。 イメージですね。 はい。で、えっと、一応タッチトニックっていうストリングには、ま、 2種類ゲージがありまして、この 1.35 よりちょっと細い感じで金性がないものと、ま、 1.35 以上と書かれてるもの、昔は、え、ボールフィールって言われた、こっちらロンジビティって言われたようにこういったちょっと 2種類のゲージが出てます。すいません。 今おっしゃいました金性がないとおっしゃったんですけども、それは加工上ということですね。 そうですね。 があるので、ちょっと、ま、少しお値段はお買い求めやすくなってますよ。でも質は十分いいものでっていうのが作、今おっしゃったように太さが違う。ま、やっぱ天然素材を使っているので、え、太い部分もあれば細い部分もあるということなんですが、ただ一定レンジの中に収まっているので、 これテンションかけて貼っちゃえば うん。 あんまり関係ないというか、均質になっちゃうと思うんですけどね。 そうですね。はい。そして ナイロンのストリンクスの中では、ま、やっぱり 1番圧倒的にってあるのはこの X1倍です。 で、こちらも当然反発性も高く、ま、このナチュラルガットを目指して作ってるっていうところも、ま、それを超えるつもりで作ってるところもあるのですごくいいソリングで人気はあるんですけど、やっぱりでもそのナチュラルのテンション性、単発性にはなかなか 勝負してくのは難しいかなと思います。 私も個人的にちょっと調べたんですよ、色々。 そうするとこの2 つって割と柔らかいように言われるじゃないですか。ただ結構しっかりしてて、えっと、ロンよりもやっぱり共同的にはしっかりしてるんですよね。そういう意味では非常に近しいテクニファイバーがエクサバイフのナチュラルを目指して作ったのもすごく頷付ける。うん。はい。 ただでもやっぱ天然物にというとこもあるんですかね。そうですね。 で、あの、皆さんこうじゃ、ナチュラルにしようかなと思った時にちょっとらうところていうのがまず 1つがこう雨にうん。 よく言われますね。 はい。 濡れちゃうとナチュラルって使えないんでしょって言われるんですけど、それはもうロンのスリンスについても濡れたら質はもう一気にガクっと落ちます。 たそういった水性っていうところはそれほど差がないですし、コーティングはもうバボランのナチュラルっていうもコーティングは昔と比べればかなり変わってるのでそこまで ナチュラルだけが全然水性に弱いってことはないと思うので、ま、同じように使っていただいていいかなと思う。 うん。 はい。 そういう意味では、ま、雨の日 そんな気にしなくてもというところですね。 そうですね。そしてもう1 個やっぱり値段がナチュラルの方がやっぱり圧倒的に高いでしょって言われてしまうんですけど、 実際今これ2つあるんですけど、えっと はい。 ストリングの価格 はい。 テクニファイバーX3倍フェガユと 4730円 はい。4730 円というのが、ま、ガッツの、ま、元々のお値段 でナチュラルタッチソニック はい。 7590円 ていうお値段が元々のストに出た。 ただタチトニックって張り上がりの価格っていうのはガットの価格よりも逆に安いんですよ。どういうことでしょう? お買読になってます。 なるほど。お はい。 どうしても ここの差って15600円。 ああ、なるほどなるほどなるほど。 だったらナチュラルをね、貼ってもいいんじゃないかっていう。 そう。パットとしては3000 円ぐらいお値段が高いものなのに 1500 円ぐらいしか貼り上がれる値段さもないので是非このナチュラルっていうのをもうちょっと身近に感じて試していただきたいかなと。 そうですね。 ま、ナチュラル打ったことない方って売られるんですかね? うん。結構いらっしゃいますよ。 売られますよね。やっぱり 1 度打つと、ま、天然物って言われるものの良さってやっぱりあるんだなって感じますもんね。 そうですね。で、やっぱり1 度ナチュラルス使い出すともうそのままずっと使い続ける方も多いので、ま、新しいラケットをご購入いただい時もそのまま差額でタチラルは貼るっていう方が多いです。 [音楽] はい。 うん。ま、これからね、12 月に向けてボーナスシーズンでもありますから、ちょっとね、 1 回こう贅沢してみようかなという気分で貼っていただいて、 ま、抜けれなくなる場合もありますけど、ま、戻すことはできるので、ま、毎月ね、切れるとかっていうことはそれほどない方が多いと思うので、そういう方にとっては 3 ヶ月半年の張り替えとして是非テンション性の高い、カンパ通力の高いこのタッチニックを試していただきたいと思います。 はい。ということで今日いいた一押しは はい。 バオラのナチュラルスリングタッチトニックを一させていただきました。 はい、是非の機会お試しください。さん、ありがとうございました。 はい、ありがとうございます。`;

const TEST_VIDEO_TITLE = "Tennis Racket Review - Babolat Touch Tonic Natural String";
const TEST_VIDEO_URL = "https://www.youtube.com/watch?v=test_sample_123";

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
    // 1) Try server-side extract-transcript first (most reliable)
    try {
      console.log('Trying extract-transcript edge function for:', videoId);
      const { data, error } = await supabase.functions.invoke('extract-transcript', {
        body: { videoId }
      });
      if (!error && data?.success && data.transcript) {
        console.log('✓ Successfully extracted transcript via extract-transcript');
        return {
          transcript: data.transcript,
          videoTitle: data.videoTitle || `Video Lesson - ${videoId}`,
          captionsAvailable: data.captionsAvailable || false,
        };
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

  const saveCurrentProject = () => {
    if (!currentProject) return;
    try {
      const stored = localStorage.getItem('projects');
      const list = stored ? JSON.parse(stored) : [];
      const entry = {
        id: currentProject.id,
        title: currentProject.title,
        url: currentProject.url,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        vocabularyCount: currentProject.vocabulary?.length || 0,
        grammarCount: currentProject.grammar?.length || 0,
        isFavorite: false,
      };
      const updated = [entry, ...list.filter((p: any) => p.url !== entry.url)];
      localStorage.setItem('projects', JSON.stringify(updated));
      toast({ title: 'Saved to Projects', description: 'Find it in the Projects tab.' });
    } catch (e) {
      console.error('Failed to save project', e);
      toast({ title: 'Save failed', description: 'Could not save project', variant: 'destructive' });
    }
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
        const issues: string[] = [];
        if (!data.youtube.success) issues.push(`YouTube: ${data.youtube.error}`);
        if (!data.openai.success) issues.push(`OpenAI: ${data.openai.error}`);
        
        toast({
          title: "❌ API Issues Found",
          description: issues.join(' | '),
          variant: "destructive",
        });
      }
      
    } catch (error: any) {
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

  const handleUseTestData = async () => {
    setIsProcessing(true);
    
    try {
      console.log('Using test data...');
      
      toast({
        title: "Loading test data",
        description: "Analyzing Japanese tennis racket video...",
      });
      
      // Use hardcoded transcript
      const transcript = TEST_TRANSCRIPT;
      
      // Still call AI analysis to test the analyze-content function
      console.log('Analyzing test content with AI...');
      const { vocabulary, grammar, detectedLanguage } = await analyzeContentWithAI(transcript);
      
      const project = {
        id: Date.now(),
        title: TEST_VIDEO_TITLE,
        url: TEST_VIDEO_URL,
        script: transcript,
        vocabulary: vocabulary,
        grammar: grammar,
        detectedLanguage: detectedLanguage
      };
      
      setCurrentProject(project);
      setActiveTab('lesson');
      
      toast({
        title: "Test data loaded successfully!",
        description: `Your lesson is ready for study. Language: ${detectedLanguage}`,
      });
      
    } catch (error) {
      console.error('Test data loading error:', error);
      toast({
        title: "Loading failed",
        description: error.message || "Could not load test data",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
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
      
      console.log('Analyzing content with AI...');
      const { vocabulary, grammar, detectedLanguage } = await analyzeContentWithAI(transcript);
      
      const project = {
        id: Date.now(),
        title: videoTitle || `Video Lesson - ${videoId}`,
        url: youtubeUrl,
        script: transcript,
        vocabulary: vocabulary,
        grammar: grammar,
        detectedLanguage: detectedLanguage
      };
      
      setCurrentProject(project);
      setActiveTab('lesson');
      
      toast({
        title: "Video processed successfully!",
        description: `Your lesson is ready for study. Language: ${detectedLanguage}`,
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
                    onClick={handleUseTestData} 
                    variant="secondary"
                    size="lg"
                    disabled={isProcessing}
                    className="flex items-center gap-2"
                  >
                    <Beaker className="w-4 h-4" />
                    Use Test Data
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
                  <Button className="w-full" variant="outline" onClick={saveCurrentProject}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Project
                  </Button>
                </div>
                <div className="space-y-4">
            <div className="space-y-4">
              {currentProject.detectedLanguage && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Detected Language:</span>
                  <Badge variant="secondary">{currentProject.detectedLanguage}</Badge>
                </div>
              )}
            <VocabularyPanel 
              vocabulary={currentProject.vocabulary} 
              grammar={currentProject.grammar}
              detectedLanguage={currentProject.detectedLanguage}
            />
            </div>
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
              <PracticeInterface project={currentProject} />
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

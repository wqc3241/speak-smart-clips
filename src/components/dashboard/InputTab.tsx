import React, { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Youtube, Loader2, Plus } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
 import { LearningPath } from "@/components/features/learning/LearningPath";
 import { QuizInterface } from "@/components/features/learning/QuizInterface";

interface InputTabProps {
    isProcessing: boolean;
    processingStep: string;
    onProcessVideo: (videoId: string, languageCode?: string, selectedLanguageName?: string) => Promise<void>;
    onUseTestData: () => Promise<void>;
}

export const InputTab: React.FC<InputTabProps> = ({
    isProcessing,
    processingStep,
    onProcessVideo,
    onUseTestData
}) => {
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [showLanguageSelector, setShowLanguageSelector] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState<string>('');
    const [pendingVideoId, setPendingVideoId] = useState<string>('');
    const { toast } = useToast();
 
     const [activeQuiz, setActiveQuiz] = useState<{ unitId: number } | null>(null);

    const extractVideoId = (url: string) => {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
        return match ? match[1] : null;
    };

    const handleUrlSubmit = () => {
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
        await onProcessVideo(pendingVideoId, languageCode, selectedLanguage);
    };

     // If quiz is active, show quiz interface
     if (activeQuiz) {
         return (
             <QuizInterface
                 unitId={activeQuiz.unitId}
                 onComplete={() => setActiveQuiz(null)}
                 onExit={() => setActiveQuiz(null)}
             />
         );
     }
 
    return (
         <div className="space-y-6">
             {/* Compact Add Video Section */}
             <Card className="border bg-card/50">
                 <CardContent className="p-3">
                     <div className="flex items-center gap-2">
                         <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                             <Plus className="w-4 h-4" />
                             <span className="hidden sm:inline">Add Video</span>
                         </div>
                         <Input
                             placeholder="Paste YouTube URL..."
                             value={youtubeUrl}
                             onChange={(e) => setYoutubeUrl(e.target.value)}
                             className="h-9 flex-1"
                         />
                         <Button
                             onClick={handleUrlSubmit}
                             size="sm"
                             disabled={isProcessing}
                             className="h-9 px-4"
                         >
                             {isProcessing ? (
                                 <Loader2 className="w-4 h-4 animate-spin" />
                             ) : (
                                 <Youtube className="w-4 h-4" />
                             )}
                         </Button>
                         <Button
                             onClick={onUseTestData}
                             variant="ghost"
                             size="sm"
                             disabled={isProcessing}
                             className="h-9 text-xs text-muted-foreground hover:text-foreground"
                         >
                             Demo
                         </Button>
                     </div>
                     {isProcessing && processingStep && (
                         <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 animate-fade-in">
                             <Loader2 className="w-3 h-3 animate-spin" />
                             <span>{processingStep}</span>
                         </div>
                     )}
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

             {/* Duolingo-style Learning Path */}
             <LearningPath onStartLesson={(unitId) => setActiveQuiz({ unitId })} />
        </div>
    );
};

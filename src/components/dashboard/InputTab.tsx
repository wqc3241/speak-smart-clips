import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoPreview } from "@/components/features/video/VideoPreview";
import { Youtube, Loader2, Beaker } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

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

    return (
        <div className="space-y-4 md:space-y-6">
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
                        onClick={onUseTestData}
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
        </div>
    );
};

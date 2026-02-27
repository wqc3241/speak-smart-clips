import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';
import { VideoDiscovery } from "@/components/features/video/VideoDiscovery";

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
    const [showLanguageSelector, setShowLanguageSelector] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState<string>('');
    const [pendingVideoId, setPendingVideoId] = useState<string>('');

    const handleVideoSelected = (videoId: string) => {
        setPendingVideoId(videoId);
        setShowLanguageSelector(true);
        setSelectedLanguage('');
    };

    const handleLanguageSelected = async () => {
        if (!pendingVideoId || !selectedLanguage) return;

        setShowLanguageSelector(false);

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
        <div className="space-y-6">
            {/* Processing indicator */}
            {isProcessing && processingStep && (
                <Card className="border bg-card/50">
                    <CardContent className="p-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{processingStep}</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Video Discovery */}
            {!showLanguageSelector && !isProcessing && (
                <VideoDiscovery
                    onSelectVideo={handleVideoSelected}
                    isProcessing={isProcessing}
                />
            )}

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

        </div>
    );
};

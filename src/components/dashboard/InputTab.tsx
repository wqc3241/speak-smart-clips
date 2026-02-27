import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';
import { VideoDiscovery } from "@/components/features/video/VideoDiscovery";

interface InputTabProps {
    isProcessing: boolean;
    processingStep: string;
    onProcessVideo: (videoId: string) => Promise<void>;
    onUseTestData: () => Promise<void>;
}

export const InputTab: React.FC<InputTabProps> = ({
    isProcessing,
    processingStep,
    onProcessVideo,
    onUseTestData
}) => {
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
            {!isProcessing && (
                <VideoDiscovery
                    onSelectVideo={(videoId) => onProcessVideo(videoId)}
                    isProcessing={isProcessing}
                />
            )}

        </div>
    );
};

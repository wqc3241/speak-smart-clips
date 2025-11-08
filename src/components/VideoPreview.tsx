import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play } from 'lucide-react';

interface VideoPreviewProps {
  url: string;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ url }) => {
  const getVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  };

  const videoId = getVideoId(url);

  return (
    <Card className="w-full border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Play className="w-5 h-5 text-primary" />
          Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {videoId ? (
          <div className="aspect-video w-full rounded-lg overflow-hidden">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              className="w-full h-full"
              allowFullScreen
              title="YouTube video preview"
            />
          </div>
        ) : (
          <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Invalid YouTube URL</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

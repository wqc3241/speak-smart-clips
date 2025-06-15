
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5 text-blue-500" />
          Video Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {videoId ? (
          <div className="aspect-video w-full">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              className="w-full h-full rounded-lg"
              allowFullScreen
              title="YouTube video preview"
            />
          </div>
        ) : (
          <div className="aspect-video w-full bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Invalid YouTube URL</p>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Badge variant="secondary">Processing...</Badge>
          <Badge variant="outline">English</Badge>
        </div>
      </CardContent>
    </Card>
  );
};

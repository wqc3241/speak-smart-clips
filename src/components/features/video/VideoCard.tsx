import React from 'react';
import { Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface VideoCardProps {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  badge?: string;
  onClick: (videoId: string) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  videoId,
  title,
  thumbnail,
  channelTitle,
  badge,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={() => onClick(videoId)}
      className="group text-left rounded-lg border bg-card overflow-hidden hover:shadow-md hover:border-primary/50 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-video bg-muted">
        <img
          src={thumbnail}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100">
            <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
          </div>
        </div>
        {badge && (
          <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
            {badge}
          </Badge>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium line-clamp-2 leading-snug">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1 truncate">{channelTitle}</p>
      </div>
    </button>
  );
};

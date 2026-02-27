import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic } from 'lucide-react';
import type { AppProject } from '@/types/project';

interface TalkProjectSelectorProps {
  projects: AppProject[];
  isLoading: boolean;
  onSelect: (project: AppProject) => void;
}

export const TalkProjectSelector: React.FC<TalkProjectSelectorProps> = ({
  projects,
  isLoading,
  onSelect,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="h-7 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="text-center py-16 border-none shadow-none">
        <CardContent>
          <Mic className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">
            No lessons available
          </h3>
          <p className="text-sm text-muted-foreground">
            Complete a lesson first to start a voice conversation
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Mic className="w-5 h-5 text-primary" />
          Voice Conversation
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose a lesson to practice speaking
        </p>
      </div>

      <div className="space-y-3">
        {projects.map((project) => (
          <Card
            key={String(project.id)}
            className="border-border hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => onSelect(project)}
          >
            <CardContent className="p-4">
              <h3 className="font-semibold text-base mb-2 line-clamp-2">
                {project.title}
              </h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  {project.detectedLanguage}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {project.vocabulary.length} words
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {project.grammar.length} grammar
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

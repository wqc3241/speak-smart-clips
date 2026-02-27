import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTalkProjects } from '@/hooks/useTalkProjects';
import { TalkProjectSelector } from './TalkProjectSelector';
import { ConversationMode } from './ConversationMode';
import type { AppProject } from '@/types/project';

export const TalkTab: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<AppProject | null>(null);
  const { projects, isLoading } = useTalkProjects();

  if (!selectedProject) {
    return (
      <TalkProjectSelector
        projects={projects}
        isLoading={isLoading}
        onSelect={setSelectedProject}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setSelectedProject(null)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Choose a different lesson
      </button>
      <ConversationMode project={selectedProject} />
    </div>
  );
};

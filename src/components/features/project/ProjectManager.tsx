import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { History, Search, Star, Trash2, Eye, Loader2 } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { AppProject, GrammarItem, PracticeSentence, VocabularyItem } from "@/types/project";

interface Project {
  id: string;
  title: string;
  youtube_url: string;
  script: string;
  vocabulary: VocabularyItem[] | null;
  grammar: GrammarItem[] | null;
  practice_sentences: PracticeSentence[] | null;
  detected_language: string | null;
  vocabulary_count: number | null;
  grammar_count: number | null;
  is_favorite: boolean;
  created_at: string;
  last_accessed: string;
  updated_at: string;
}

interface ProjectManagerProps {
  onLoadProject?: (project: AppProject) => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ onLoadProject }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getCurrentUserId = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user?.id ?? null;
  };

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        setProjects([]);
        return;
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setProjects(data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error('Failed to fetch projects:', error);
      toast({
        title: "Failed to load projects",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filteredProjects = projects.filter(project =>
    project.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleFavorite = async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    
    const userId = await getCurrentUserId();
    let updateQuery = supabase
      .from('projects')
      .update({ is_favorite: !project.is_favorite })
      .eq('id', id);

    if (userId) {
      updateQuery = updateQuery.eq('user_id', userId);
    }

    const { error } = await updateQuery;
    
    if (error) {
      toast({
        title: "Failed to update favorite",
        variant: "destructive",
      });
    } else {
      setProjects(projects.map(p => 
        p.id === id ? { ...p, is_favorite: !p.is_favorite } : p
      ));
    }
  };

  const deleteProject = async (id: string) => {
    const confirmDelete = confirm('Are you sure you want to delete this project?');
    if (!confirmDelete) return;
    
    const userId = await getCurrentUserId();
    let deleteQuery = supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (userId) {
      deleteQuery = deleteQuery.eq('user_id', userId);
    }

    const { error } = await deleteQuery;
    
    if (error) {
      toast({
        title: "Failed to delete project",
        variant: "destructive",
      });
    } else {
      setProjects(projects.filter(p => p.id !== id));
      toast({ 
        title: "Project deleted",
      });
    }
  };

  const loadProject = async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project || !onLoadProject) return;
    
    // Update last_accessed timestamp
    let userId: string | null = null;
    try {
      userId = await getCurrentUserId();
    } catch (error) {
      console.error('Failed to load user for project update:', error);
    }
    let updateQuery = supabase
      .from('projects')
      .update({ last_accessed: new Date().toISOString() })
      .eq('id', id);

    if (userId) {
      updateQuery = updateQuery.eq('user_id', userId);
    }

    await updateQuery;
    
    // Transform database format to app format
    const loadedProject = {
      id: project.id,
      title: project.title,
      url: project.youtube_url,
      script: project.script,
      vocabulary: project.vocabulary || [],
      grammar: project.grammar || [],
      practiceSentences: project.practice_sentences || [],
      detectedLanguage: project.detected_language || 'Unknown',
    };
    
    onLoadProject(loadedProject);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Projects
        </h2>
        <Badge variant="secondary">{projects.length}</Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Projects List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="text-center py-16 border-none shadow-none">
          <CardContent>
            <History className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              No projects found
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm ? 'Try adjusting your search' : 'Create your first project!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-280px)] md:h-[600px]">
          <div className="space-y-3 pr-4">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="border-border hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  {/* Header with Title and Favorite */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base truncate">{project.title}</h3>
                        {project.is_favorite && (
                          <Star className="w-3.5 h-3.5 text-yellow-500 fill-current shrink-0" />
                        )}
                      </div>
                      {project.detected_language && (
                        <Badge variant="secondary" className="text-xs mb-2">
                          {project.detected_language}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-3 text-xs text-muted-foreground mb-3">
                    <span>{project.vocabulary_count || 0} words</span>
                    <span>•</span>
                    <span>{project.grammar_count || 0} grammar</span>
                    <span>•</span>
                    <span>{formatDate(project.last_accessed)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadProject(project.id)}
                      className="flex-1"
                    >
                      <Eye className="w-3.5 h-3.5 mr-2" />
                      Open
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFavorite(project.id)}
                    >
                      <Star className={`w-3.5 h-3.5 ${
                        project.is_favorite ? 'text-yellow-500 fill-current' : 'text-muted-foreground'
                      }`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteProject(project.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

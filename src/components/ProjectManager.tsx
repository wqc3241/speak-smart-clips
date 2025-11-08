import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { History, Search, Star, Trash2, Eye, Loader2 } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Project {
  id: string;
  title: string;
  youtube_url: string;
  script: string;
  vocabulary: any;
  grammar: any;
  practice_sentences: any;
  detected_language: string | null;
  vocabulary_count: number | null;
  grammar_count: number | null;
  is_favorite: boolean;
  created_at: string;
  last_accessed: string;
  updated_at: string;
}

interface ProjectManagerProps {
  onLoadProject?: (project: any) => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ onLoadProject }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setProjects(data || []);
    } catch (error: any) {
      console.error('Failed to fetch projects:', error);
      toast({
        title: "Failed to load projects",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProjects = projects.filter(project =>
    project.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleFavorite = async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    
    const { error } = await supabase
      .from('projects')
      .update({ is_favorite: !project.is_favorite })
      .eq('id', id);
    
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
    
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast({
        title: "Failed to delete project",
        variant: "destructive",
      });
    } else {
      setProjects(projects.filter(p => p.id !== id));
      toast({ 
        title: "Project deleted",
        description: "The project has been removed successfully.",
      });
    }
  };

  const loadProject = async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project || !onLoadProject) return;
    
    // Update last_accessed timestamp
    await supabase
      .from('projects')
      .update({ last_accessed: new Date().toISOString() })
      .eq('id', id);
    
    // Transform database format to app format
    const loadedProject = {
      id: project.id,
      title: project.title,
      url: project.youtube_url,
      script: project.script,
      vocabulary: project.vocabulary,
      grammar: project.grammar,
      practiceSentences: project.practice_sentences,
      detectedLanguage: project.detected_language,
    };
    
    onLoadProject(loadedProject);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-500" />
            My Language Learning Projects
          </CardTitle>
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary">{projects.length} projects</Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {filteredProjects.map((project) => (
                  <Card key={project.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{project.title}</h3>
                            {project.is_favorite && (
                              <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{project.youtube_url}</p>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span>Created: {formatDate(project.created_at)}</span>
                            <span>Last accessed: {formatDate(project.last_accessed)}</span>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">
                              {project.vocabulary_count || 0} words
                            </Badge>
                            <Badge variant="outline">
                              {project.grammar_count || 0} grammar points
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleFavorite(project.id)}
                            title={project.is_favorite ? "Remove from favorites" : "Add to favorites"}
                          >
                            <Star className={`w-4 h-4 ${project.is_favorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => loadProject(project.id)}
                            title="Load this project"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteProject(project.id)}
                            className="text-red-500 hover:text-red-700"
                            title="Delete this project"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
          
          {filteredProjects.length === 0 && (
            <div className="text-center py-8">
              <History className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                No projects found
              </h3>
              <p className="text-gray-500">
                {searchTerm ? 'Try adjusting your search terms' : 'Create your first language learning project!'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

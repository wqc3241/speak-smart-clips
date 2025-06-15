
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { History, Search, Star, Trash2, Eye } from 'lucide-react';

interface Project {
  id: number;
  title: string;
  url: string;
  createdAt: Date;
  lastAccessed: Date;
  vocabularyCount: number;
  grammarCount: number;
  isFavorite: boolean;
}

export const ProjectManager: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [projects, setProjects] = useState<Project[]>([
    {
      id: 1,
      title: "English Conversation Tips",
      url: "https://youtube.com/watch?v=example1",
      createdAt: new Date(2024, 5, 10),
      lastAccessed: new Date(2024, 5, 14),
      vocabularyCount: 15,
      grammarCount: 5,
      isFavorite: true
    },
    {
      id: 2,
      title: "Business English Presentation",
      url: "https://youtube.com/watch?v=example2",
      createdAt: new Date(2024, 5, 8),
      lastAccessed: new Date(2024, 5, 12),
      vocabularyCount: 22,
      grammarCount: 8,
      isFavorite: false
    },
    {
      id: 3,
      title: "Daily Life Vocabulary",
      url: "https://youtube.com/watch?v=example3",
      createdAt: new Date(2024, 5, 5),
      lastAccessed: new Date(2024, 5, 10),
      vocabularyCount: 18,
      grammarCount: 6,
      isFavorite: true
    }
  ]);

  const filteredProjects = projects.filter(project =>
    project.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleFavorite = (id: number) => {
    setProjects(projects.map(project =>
      project.id === id ? { ...project, isFavorite: !project.isFavorite } : project
    ));
  };

  const deleteProject = (id: number) => {
    setProjects(projects.filter(project => project.id !== id));
  };

  const formatDate = (date: Date) => {
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
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {filteredProjects.map((project) => (
                <Card key={project.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{project.title}</h3>
                          {project.isFavorite && (
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mb-3">{project.url}</p>
                        <div className="flex gap-4 text-sm text-gray-600">
                          <span>Created: {formatDate(project.createdAt)}</span>
                          <span>Last accessed: {formatDate(project.lastAccessed)}</span>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline">
                            {project.vocabularyCount} words
                          </Badge>
                          <Badge variant="outline">
                            {project.grammarCount} grammar points
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFavorite(project.id)}
                        >
                          <Star className={`w-4 h-4 ${project.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteProject(project.id)}
                          className="text-red-500 hover:text-red-700"
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

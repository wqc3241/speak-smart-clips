import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User } from '@supabase/supabase-js';

export const useProject = (user: User | null) => {
    const [currentProject, setCurrentProject] = useState<any>(null);
    const { toast } = useToast();

    const saveProject = async (projectToSave: any = currentProject) => {
        if (!projectToSave) return;

        try {
            console.log('Saving project to database...');

            // Check if project with this URL already exists for this user
            const { data: existing, error: checkError } = await supabase
                .from('projects')
                .select('id, title')
                .eq('youtube_url', projectToSave.url)
                .eq('user_id', user?.id)
                .maybeSingle();

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            if (existing) {
                // Project already exists - update it
                const confirmUpdate = confirm(
                    `A project with this YouTube video already exists: "${existing.title}". Do you want to update it?`
                );

                if (!confirmUpdate) {
                    toast({
                        title: "Save cancelled",
                        description: "The existing project was not modified.",
                    });
                    return;
                }

                // Update existing project
                const { error: updateError } = await supabase
                    .from('projects')
                    .update({
                        title: projectToSave.title,
                        script: projectToSave.script,
                        vocabulary: projectToSave.vocabulary,
                        grammar: projectToSave.grammar,
                        practice_sentences: projectToSave.practiceSentences || [],
                        detected_language: projectToSave.detectedLanguage,
                        last_accessed: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);

                if (updateError) throw updateError;

                toast({
                    title: "Project updated!",
                    description: "Your project has been updated successfully.",
                });
            } else {
                // New project - insert it
                const { error: insertError } = await supabase
                    .from('projects')
                    .insert({
                        youtube_url: projectToSave.url,
                        title: projectToSave.title,
                        script: projectToSave.script,
                        vocabulary: projectToSave.vocabulary,
                        grammar: projectToSave.grammar,
                        practice_sentences: projectToSave.practiceSentences || [],
                        detected_language: projectToSave.detectedLanguage,
                        is_favorite: false,
                        user_id: user?.id,
                    });

                if (insertError) throw insertError;

                toast({
                    title: "Project saved!",
                    description: "Find it in the Projects tab.",
                });
            }

        } catch (error: any) {
            console.error('Failed to save project:', error);
            toast({
                title: "Save failed",
                description: error.message || "Could not save project",
                variant: "destructive",
            });
        }
    };

    return {
        currentProject,
        setCurrentProject,
        saveProject
    };
};

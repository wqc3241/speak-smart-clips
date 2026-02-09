import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { User } from '@supabase/supabase-js';
import type { AppProject } from '@/types/project';

export const useProject = (user: User | null) => {
    const [currentProject, setCurrentProject] = useState<AppProject | null>(null);

    const autoSaveProject = async (projectToSave: AppProject) => {
        if (!projectToSave || !user?.id) return;

        try {
            console.log('Auto-saving project to database...');

            // Check if project with this URL already exists for this user
            const { data: existing, error: checkError } = await supabase
                .from('projects')
                .select('id')
                .eq('youtube_url', projectToSave.url)
                .eq('user_id', user.id)
                .maybeSingle();

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            if (existing) {
                // Update existing project
                const { error: updateError } = await supabase
                    .from('projects')
                    .update({
                        title: projectToSave.title,
                        script: projectToSave.script || '',
                        vocabulary: projectToSave.vocabulary || [],
                        grammar: projectToSave.grammar || [],
                        practice_sentences: projectToSave.practiceSentences || [],
                        detected_language: projectToSave.detectedLanguage,
                        status: projectToSave.status || 'completed',
                        job_id: projectToSave.jobId,
                        error_message: projectToSave.errorMessage,
                        last_accessed: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);

                if (updateError) throw updateError;
            } else {
                // Insert new project
                const { error: insertError } = await supabase
                    .from('projects')
                    .insert({
                        youtube_url: projectToSave.url,
                        title: projectToSave.title,
                        script: projectToSave.script || '',
                        vocabulary: projectToSave.vocabulary || [],
                        grammar: projectToSave.grammar || [],
                        practice_sentences: projectToSave.practiceSentences || [],
                        detected_language: projectToSave.detectedLanguage,
                        status: projectToSave.status || 'completed',
                        job_id: projectToSave.jobId,
                        error_message: projectToSave.errorMessage,
                        is_favorite: false,
                        user_id: user.id,
                    });

                if (insertError) throw insertError;
            }

            // Silent save - no toast notification
            console.log('Project auto-saved successfully');
        } catch (error: unknown) {
            console.error('Auto-save failed:', error);
            // Don't show error toast for auto-save failures
        }
    };

    return {
        currentProject,
        setCurrentProject,
        autoSaveProject
    };
};

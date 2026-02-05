 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const CORS_HEADERS = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 function extractVideoId(url: string): string | null {
   const patterns = [
     /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
     /^([a-zA-Z0-9_-]{11})$/
   ];
   
   for (const pattern of patterns) {
     const match = url.match(pattern);
     if (match) return match[1];
   }
   return null;
 }
 
 async function fetchVideoTitle(videoId: string, supadataApiKey: string): Promise<string | null> {
   try {
     const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
     const response = await fetch(
       `https://api.supadata.ai/v1/metadata?url=${encodeURIComponent(videoUrl)}`,
       {
         method: 'GET',
         headers: { 'x-api-key': supadataApiKey },
       }
     );
     
     if (response.ok) {
       const data = await response.json();
       if (data.title) {
         return data.title;
       }
     }
   } catch (error) {
     console.warn('Failed to fetch video title for', videoId, error);
   }
   return null;
 }
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: CORS_HEADERS });
   }
 
   try {
     const supadataApiKey = Deno.env.get('SUPADATA_API_KEY');
     if (!supadataApiKey) {
       throw new Error('Supadata API key not configured');
     }
 
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     // Find all projects with placeholder titles (matching "Video XXXXXXXXXXX" pattern)
     const { data: projects, error: fetchError } = await supabase
       .from('projects')
       .select('id, title, youtube_url')
       .like('title', 'Video %');
 
     if (fetchError) {
       throw new Error(`Failed to fetch projects: ${fetchError.message}`);
     }
 
     console.log(`Found ${projects?.length || 0} projects with placeholder titles`);
 
     const results: { id: string; oldTitle: string; newTitle: string; success: boolean }[] = [];
 
     for (const project of projects || []) {
       const videoId = extractVideoId(project.youtube_url);
       
       if (!videoId) {
         console.warn(`Could not extract video ID from: ${project.youtube_url}`);
         results.push({ id: project.id, oldTitle: project.title, newTitle: project.title, success: false });
         continue;
       }
 
       const newTitle = await fetchVideoTitle(videoId, supadataApiKey);
       
       if (newTitle && newTitle !== project.title) {
         const { error: updateError } = await supabase
           .from('projects')
           .update({ title: newTitle })
           .eq('id', project.id);
 
         if (updateError) {
           console.error(`Failed to update project ${project.id}:`, updateError);
           results.push({ id: project.id, oldTitle: project.title, newTitle: project.title, success: false });
         } else {
           console.log(`Updated: "${project.title}" -> "${newTitle}"`);
           results.push({ id: project.id, oldTitle: project.title, newTitle, success: true });
         }
       } else {
         results.push({ id: project.id, oldTitle: project.title, newTitle: project.title, success: false });
       }
     }
 
     const successCount = results.filter(r => r.success).length;
 
     return new Response(JSON.stringify({
       message: `Migration complete. Updated ${successCount} of ${results.length} projects.`,
       results
     }), {
       headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
     });
 
   } catch (error) {
     console.error('Migration error:', error);
     return new Response(JSON.stringify({
       error: (error as Error).message || 'Migration failed'
     }), {
       status: 500,
       headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
     });
   }
 });
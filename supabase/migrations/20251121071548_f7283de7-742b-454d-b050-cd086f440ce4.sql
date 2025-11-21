-- Make the App_Image bucket public so the avatar is accessible to everyone
UPDATE storage.buckets 
SET public = true 
WHERE id = 'App_Image';
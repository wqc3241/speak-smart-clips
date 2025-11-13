-- Add INSERT policy for profiles table
-- This allows users to create only their own profile record
-- Prevents account hijacking by ensuring users can only insert profiles with their own user_id

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);
-- Fix infinite recursion in admin role policy by using security definer function
-- Drop the broken policy that queries user_roles within itself
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Create correct policy using the has_role() security definer function
-- This prevents infinite recursion because the function executes with elevated privileges
CREATE POLICY "Admins can manage all roles"
    ON public.user_roles
    FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));
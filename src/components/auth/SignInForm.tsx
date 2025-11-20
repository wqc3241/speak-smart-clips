import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { emailSchema, passwordSchema } from "@/lib/validation";

interface SignInFormProps {
    onForgotPassword: () => void;
}

export const SignInForm = ({ onForgotPassword }: SignInFormProps) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

    const validateForm = () => {
        const newErrors: typeof errors = {};

        const emailResult = emailSchema.safeParse(email);
        if (!emailResult.success) {
            newErrors.email = emailResult.error.errors[0].message;
        }

        const passwordResult = passwordSchema.safeParse(password);
        if (!passwordResult.success) {
            newErrors.password = passwordResult.error.errors[0].message;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        });

        if (error) {
            toast({
                title: "Login failed",
                description: error.message,
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success!",
                description: "You've been logged in successfully.",
            });
            // Navigation handled by parent's auth listener
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                />
                {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                />
                {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                )}
            </div>

            <div className="flex justify-end">
                <Button
                    type="button"
                    variant="link"
                    className="px-0 font-normal text-sm"
                    onClick={onForgotPassword}
                    disabled={loading}
                >
                    Forgot Password?
                </Button>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing in...
                    </>
                ) : (
                    "Sign In"
                )}
            </Button>
        </form>
    );
};

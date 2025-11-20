import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { emailSchema, passwordSchema } from "@/lib/validation";

export const SignUpForm = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [errors, setErrors] = useState<{
        email?: string;
        password?: string;
        confirmPassword?: string;
    }>({});

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

        if (password !== confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleEmailSignUp = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        const redirectUrl = `${window.location.origin}/`;

        const { error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
                emailRedirectTo: redirectUrl,
                data: {
                    full_name: fullName.trim() || null,
                },
            },
        });

        if (error) {
            toast({
                title: "Signup failed",
                description: error.message,
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success!",
                description: "Please check your email to confirm your account.",
            });
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="signup-name">Full Name (optional)</Label>
                <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                    maxLength={100}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                    id="signup-email"
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
                <Label htmlFor="signup-password">Password</Label>
                <Input
                    id="signup-password"
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

            <div className="space-y-2">
                <Label htmlFor="signup-confirm">Confirm Password</Label>
                <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    required
                />
                {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating account...
                    </>
                ) : (
                    "Create Account"
                )}
            </Button>
        </form>
    );
};

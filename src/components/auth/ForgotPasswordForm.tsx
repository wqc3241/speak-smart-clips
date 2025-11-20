import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { emailSchema } from "@/lib/validation";

interface ForgotPasswordFormProps {
    onBack: () => void;
}

export const ForgotPasswordForm = ({ onBack }: ForgotPasswordFormProps) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate email
        const emailResult = emailSchema.safeParse(email);
        if (!emailResult.success) {
            toast({
                title: "Invalid email",
                description: emailResult.error.errors[0].message,
                variant: "destructive",
            });
            return;
        }

        setLoading(true);
        const redirectUrl = `${window.location.origin}/auth`;

        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: redirectUrl,
        });

        if (error) {
            toast({
                title: "Password reset failed",
                description: error.message,
                variant: "destructive",
            });
        } else {
            toast({
                title: "Check your email",
                description: "We've sent you a password reset link. Please check your email.",
            });
            onBack();
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending reset link...
                    </>
                ) : (
                    "Send Reset Link"
                )}
            </Button>

            <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={onBack}
                disabled={loading}
            >
                Back to Sign In
            </Button>
        </form>
    );
};

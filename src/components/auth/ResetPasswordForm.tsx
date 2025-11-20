import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { passwordSchema } from "@/lib/validation";

interface ResetPasswordFormProps {
    onSuccess: () => void;
}

export const ResetPasswordForm = ({ onSuccess }: ResetPasswordFormProps) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate passwords
        const passwordResult = passwordSchema.safeParse(newPassword);
        if (!passwordResult.success) {
            toast({
                title: "Invalid password",
                description: passwordResult.error.errors[0].message,
                variant: "destructive",
            });
            return;
        }

        if (newPassword !== confirmNewPassword) {
            toast({
                title: "Passwords don't match",
                description: "Please make sure both passwords are the same.",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.updateUser({
            password: newPassword,
        });

        if (error) {
            toast({
                title: "Password reset failed",
                description: error.message,
                variant: "destructive",
            });
        } else {
            toast({
                title: "Password updated!",
                description: "Your password has been successfully reset. You can now sign in.",
            });
            onSuccess();
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                <Input
                    id="confirm-new-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    disabled={loading}
                    required
                />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Updating password...
                    </>
                ) : (
                    "Reset Password"
                )}
            </Button>
        </form>
    );
};

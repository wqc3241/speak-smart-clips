import React from 'react';
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon } from 'lucide-react';
import { User } from '@supabase/supabase-js';

interface HeaderProps {
    user: User | null;
    onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
    return (
        <>
            {/* Header - Desktop only */}
            <header className="hidden md:block border-b bg-card/50 backdrop-blur sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4 flex items-center gap-4">
                    <img
                        src="/orange_fox.png"
                        alt="App Mascot"
                        className="w-16 h-16 object-contain hover:rotate-12 transition-transform duration-300"
                    />
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">
                            Speak Smart Clips
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Learn languages from YouTube videos
                        </p>
                    </div>
                </div>
            </header>

            {/* Mobile Header */}
            <header className="md:hidden border-b bg-card sticky top-0 z-10 backdrop-blur">
                <div className="px-4 py-3 flex items-center gap-3">
                    <img
                        src="/orange_fox.png"
                        alt="App Mascot"
                        className="w-10 h-10 object-contain"
                    />
                    <h1 className="text-lg font-bold text-foreground">Speak Smart Clips</h1>
                </div>
            </header>

            {/* User Header Section (inside Main in original, but logically a header part) */}
            {user && (
                <div className="container mx-auto px-4 pt-6 md:pt-8">
                    <div className="mb-4 flex items-center justify-between bg-card p-4 rounded-lg border">
                        <div className="flex items-center gap-2">
                            <UserIcon className="w-5 h-5 text-primary" />
                            <span className="text-sm text-muted-foreground">
                                {user.email}
                            </span>
                        </div>
                        <Button variant="outline" size="sm" onClick={onLogout}>
                            <LogOut className="w-4 h-4 mr-2" />
                            Logout
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
};

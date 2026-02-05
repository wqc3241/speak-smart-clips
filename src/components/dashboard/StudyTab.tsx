import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScriptDisplay } from "@/components/features/video/ScriptDisplay";
import { VocabularyPanel } from "@/components/features/vocabulary/VocabularyPanel";
import { BookOpen, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface StudyTabProps {
    currentProject: any;
    isProcessing: boolean;
    processingStep: string;
    onUpdateProject: (project: any) => void;
    onRegenerateAnalysis: () => Promise<void>;
}

export const StudyTab: React.FC<StudyTabProps> = ({
    currentProject,
    isProcessing,
    processingStep,
    onUpdateProject,
    onRegenerateAnalysis
}) => {
    const { toast } = useToast();

    if (!currentProject) {
        return (
            <Card className="text-center py-16 border-none shadow-none">
                <CardContent>
                    <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                        No lesson yet
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Add a YouTube video to start learning
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Status Indicators */}
            {currentProject.status === 'pending' && (
                <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-yellow-700 dark:text-yellow-300" />
                            <span className="text-yellow-700 dark:text-yellow-300">
                                AI transcript generation in progress...
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {currentProject.status === 'failed' && (
                <Card className="border-red-500 bg-red-50 dark:bg-red-950">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-700 dark:text-red-300" />
                            <span className="text-red-700 dark:text-red-300">
                                Generation failed: {currentProject.errorMessage || 'Unknown error'}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Language Selector */}
            {currentProject.detectedLanguage && (
                <Card className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">Detected language:</span>
                            <Select
                                value={currentProject.detectedLanguage}
                                onValueChange={(value) => {
                                    onUpdateProject({
                                        ...currentProject,
                                        detectedLanguage: value
                                    });
                                    toast({
                                        title: "Language updated",
                                        description: `Changed to ${value}. Click "Regenerate" to re-analyze.`
                                    });
                                }}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Japanese">Japanese</SelectItem>
                                    <SelectItem value="Chinese">Chinese (Mandarin)</SelectItem>
                                    <SelectItem value="Korean">Korean</SelectItem>
                                    <SelectItem value="Spanish">Spanish</SelectItem>
                                    <SelectItem value="French">French</SelectItem>
                                    <SelectItem value="German">German</SelectItem>
                                    <SelectItem value="Italian">Italian</SelectItem>
                                    <SelectItem value="Portuguese">Portuguese</SelectItem>
                                    <SelectItem value="Russian">Russian</SelectItem>
                                    <SelectItem value="Arabic">Arabic</SelectItem>
                                    <SelectItem value="Hindi">Hindi</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRegenerateAnalysis}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Regenerating...
                                </>
                            ) : (
                                'Regenerate Analysis'
                            )}
                        </Button>
                    </div>
                    {isProcessing && processingStep && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3 animate-fade-in">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{processingStep}</span>
                        </div>
                    )}
                </Card>
            )}

            {/* Content Grid - Only show if not pending */}
            {currentProject.status !== 'pending' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                    <ScriptDisplay
                        script={currentProject.script}
                        language={currentProject.detectedLanguage}
                    />
                    <VocabularyPanel
                        vocabulary={currentProject.vocabulary}
                        grammar={currentProject.grammar}
                        detectedLanguage={currentProject.detectedLanguage}
                    />
                </div>
            )}
        </div>
    );
};

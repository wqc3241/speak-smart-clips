import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScriptDisplay } from "@/components/features/video/ScriptDisplay";
import { VocabularyPanel } from "@/components/features/vocabulary/VocabularyPanel";
import { Save, BookOpen, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface StudyTabProps {
    currentProject: any;
    isProcessing: boolean;
    processingStep: string;
    onSaveProject: () => void;
    onUpdateProject: (project: any) => void;
    onRegenerateAnalysis: () => Promise<void>;
}

export const StudyTab: React.FC<StudyTabProps> = ({
    currentProject,
    isProcessing,
    processingStep,
    onSaveProject,
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
            {/* Save Button - Top on mobile */}
            <Button className="w-full md:hidden" onClick={onSaveProject}>
                <Save className="w-4 h-4 mr-2" />
                Save Project
            </Button>

            {/* Language Selector */}
            {currentProject.detectedLanguage && (
                <Card className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2 flex-1">
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
                            className="w-full sm:w-auto"
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

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-4">
                    <ScriptDisplay script={currentProject.script} />
                    <Button className="w-full hidden md:flex" variant="outline" onClick={onSaveProject}>
                        <Save className="w-4 h-4 mr-2" />
                        Save Project
                    </Button>
                </div>
                <VocabularyPanel
                    vocabulary={currentProject.vocabulary}
                    grammar={currentProject.grammar}
                    detectedLanguage={currentProject.detectedLanguage}
                />
            </div>
        </div>
    );
};

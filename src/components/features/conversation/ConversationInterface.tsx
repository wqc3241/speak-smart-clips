import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Mic, MicOff, Send, Volume2 } from 'lucide-react';
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import type { AppProject, VocabularyItem } from "@/types/project";

interface ConversationInterfaceProps {
  project: AppProject;
}

interface Message {
  id: number;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  suggestedWords?: string[];
}

export const ConversationInterface: React.FC<ConversationInterfaceProps> = ({ project }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: 'ai',
      text: `Hi! Let's practice using vocabulary from your lesson. Try using words like "${project.vocabulary[0]?.word}" or "${project.vocabulary[1]?.word}"!`,
      timestamp: new Date(),
      suggestedWords: project.vocabulary.slice(0, 3).map((v: VocabularyItem) => v.word)
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const { speak, isPlaying, currentText } = useTextToSpeech();

  const handleSendMessage = () => {
    if (!currentMessage.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      sender: 'user',
      text: currentMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: messages.length + 2,
        sender: 'ai',
        text: `Great! I noticed you used some key words. Let's continue practicing. Can you tell me more?`,
        timestamp: new Date(),
        suggestedWords: project.vocabulary.slice(2, 5).map((v: VocabularyItem) => v.word)
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1500);
  };

  const toggleListening = () => {
    setIsListening(!isListening);
    console.log('Speech recognition:', !isListening ? 'started' : 'stopped');
  };

  return (
    <Card className="h-[calc(100vh-200px)] md:h-[600px] flex flex-col border-border">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          AI Conversation
        </CardTitle>
        <Badge variant="outline" className="w-fit">{project.vocabulary.length} words</Badge>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4 pt-4">
          <div className="space-y-3 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] p-3 rounded-2xl ${
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  {message.sender === 'ai' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-6 px-2"
                      onClick={() => speak(message.text)}
                    >
                      <Volume2 className={`w-3 h-3 ${
                        isPlaying && currentText === message.text ? 'text-primary animate-pulse' : ''
                      }`} />
                    </Button>
                  )}
                  {message.suggestedWords && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.suggestedWords.map((word, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="text-xs cursor-pointer"
                          onClick={() => setCurrentMessage(prev => prev + ' ' + word)}
                        >
                          {word}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-card">
          <div className="flex gap-2">
            <Button
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              onClick={toggleListening}
              className="shrink-0"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Input
              placeholder="Type your message..."
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={!currentMessage.trim()}
              size="icon"
              className="shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

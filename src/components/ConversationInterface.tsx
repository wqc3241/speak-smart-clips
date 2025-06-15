
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Mic, MicOff, Send, Volume2 } from 'lucide-react';

interface ConversationInterfaceProps {
  project: any;
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
      text: `Hello! I'm your AI conversation partner. Let's practice using the vocabulary and grammar from your video lesson. Try using words like "${project.vocabulary[0]?.word}" or "${project.vocabulary[1]?.word}" in our conversation!`,
      timestamp: new Date(),
      suggestedWords: project.vocabulary.slice(0, 3).map((v: any) => v.word)
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);

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
        text: `Great use of vocabulary! I noticed you used some key words from the lesson. Let's continue practicing. Can you tell me more about the topic using the grammar structure we learned?`,
        timestamp: new Date(),
        suggestedWords: project.vocabulary.slice(2, 5).map((v: any) => v.word)
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1500);
  };

  const toggleListening = () => {
    setIsListening(!isListening);
    // In a real app, this would start/stop speech recognition
    console.log('Speech recognition:', !isListening ? 'started' : 'stopped');
  };

  const speakText = (text: string) => {
    setIsAISpeaking(true);
    // In a real app, this would use text-to-speech
    console.log('Speaking:', text);
    setTimeout(() => setIsAISpeaking(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-500" />
            AI Conversation Practice
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">Focus: {project.title}</Badge>
            <Badge variant="secondary">{project.vocabulary.length} vocabulary words</Badge>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 mb-4 pr-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      message.sender === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                    {message.sender === 'ai' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-6 p-1"
                        onClick={() => speakText(message.text)}
                        disabled={isAISpeaking}
                      >
                        <Volume2 className="w-3 h-3" />
                      </Button>
                    )}
                    {message.suggestedWords && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {message.suggestedWords.map((word, index) => (
                          <Badge
                            key={index}
                            variant="outline"
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

          <div className="flex gap-2">
            <Button
              variant={isListening ? "destructive" : "outline"}
              size="sm"
              onClick={toggleListening}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Input
              placeholder="Type your message or use voice input..."
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={!currentMessage.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

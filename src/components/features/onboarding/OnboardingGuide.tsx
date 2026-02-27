import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Youtube,
  GraduationCap,
  BookOpen,
  Mic,
  ArrowRight,
  X,
} from 'lucide-react';

const ONBOARDING_KEY = 'breaklingo-onboarding-complete';

const STEPS = [
  {
    icon: Youtube,
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    title: 'Welcome to BreakLingo!',
    body: 'Start by searching for a YouTube video in the language you want to learn. Pick any video with captions — we\u2019ll extract the content and create a personalized lesson for you.',
    cta: 'Next',
  },
  {
    icon: BookOpen,
    iconBg: 'bg-blue-100 dark:bg-blue-950',
    iconColor: 'text-blue-600 dark:text-blue-400',
    title: 'Your Lesson is Built',
    body: 'We extract vocabulary, grammar patterns, and practice sentences from the video. Everything is organized into a structured lesson you can study at your own pace.',
    cta: 'Next',
  },
  {
    icon: GraduationCap,
    iconBg: 'bg-amber-100 dark:bg-amber-950',
    iconColor: 'text-amber-600 dark:text-amber-400',
    title: 'Learn & Practice',
    body: 'Study vocabulary and grammar, then test yourself with interactive quizzes. Practice sentences with AI-powered feedback to build confidence.',
    cta: 'Next',
  },
  {
    icon: Mic,
    iconBg: 'bg-green-100 dark:bg-green-950',
    iconColor: 'text-green-600 dark:text-green-400',
    title: 'Speak with AI',
    body: 'Have real-time voice conversations with an AI tutor. It uses vocabulary and grammar from your lessons and gently corrects your mistakes.',
    cta: 'Get Started',
  },
] as const;

export const OnboardingGuide: React.FC = () => {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!localStorage.getItem(ONBOARDING_KEY)) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setVisible(false);
  };

  const handleCta = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40 animate-fade-in" />

      {/* Modal */}
      <div className="fixed z-50 inset-0 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-2xl border-primary/30 animate-fade-in relative">
          {/* Skip / close button */}
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close guide"
          >
            <X className="w-4 h-4" />
          </button>

          <CardContent className="p-6">
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    i < step
                      ? 'bg-primary'
                      : i === step
                        ? 'bg-primary animate-pulse'
                        : 'bg-muted'
                  }`}
                />
              ))}
            </div>

            {/* Icon + heading */}
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-12 h-12 rounded-full ${current.iconBg} flex items-center justify-center`}
              >
                <Icon className={`w-6 h-6 ${current.iconColor}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{current.title}</h3>
                <p className="text-xs text-muted-foreground">
                  Step {step + 1} of {STEPS.length}
                </p>
              </div>
            </div>

            {/* Body */}
            <p className="text-sm text-muted-foreground mb-5">{current.body}</p>

            {/* CTA */}
            <Button onClick={handleCta} className="w-full gap-2">
              {current.cta}
              {step < STEPS.length - 1 && <ArrowRight className="w-4 h-4" />}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

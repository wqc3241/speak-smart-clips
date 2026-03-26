import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { AVATAR_URL } from "@/lib/constants";
import {
  Youtube,
  BookOpen,
  MessageCircle,
  Mic,
  Search,
  Sparkles,
  GraduationCap,
  ArrowRight,
  Play,
  CheckCircle2,
} from "lucide-react";

const Landing = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={AVATAR_URL}
              alt="BreakLingo mascot"
              className="h-10 w-10 rounded-lg object-contain"
            />
            <span className="text-xl font-bold text-foreground">BreakLingo</span>
          </Link>
          <Link to={isLoggedIn ? "/dashboard" : "/auth"}>
            <Button variant={isLoggedIn ? "default" : "outline"} size="sm">
              {isLoggedIn ? "Go to Dashboard" : "Sign In"}
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/30" />
        <div className="container relative mx-auto px-4 py-20 md:py-28">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div className="space-y-6">
              <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
                Learn Languages from{" "}
                <span className="text-primary">Real Videos</span>
              </h1>
              <p className="max-w-lg text-lg text-muted-foreground">
                Turn any YouTube video into an interactive language lesson. AI extracts vocabulary, grammar, and creates personalized quizzes — so you learn from content you actually enjoy.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to={isLoggedIn ? "/dashboard" : "/auth"}>
                  <Button size="lg" className="gap-2">
                    <Play className="h-4 w-4" />
                    {isLoggedIn ? "Open Dashboard" : "Get Started Free"}
                  </Button>
                </Link>
                <a
                  href="https://apps.apple.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="lg" className="gap-2">
                    Download iOS App
                  </Button>
                </a>
              </div>
            </div>
            <div className="flex justify-center">
              <img
                src={AVATAR_URL}
                alt="BreakLingo fox mascot"
                className="w-64 drop-shadow-xl transition-transform duration-500 hover:scale-105 md:w-80"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-b py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground">
              Everything You Need to Learn
            </h2>
            <p className="mt-3 text-muted-foreground">
              Powered by AI, designed for real-world language skills
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<Search className="h-6 w-6" />}
              title="YouTube Search"
              description="Find videos in any language and instantly create lessons from real content."
            />
            <FeatureCard
              icon={<Sparkles className="h-6 w-6" />}
              title="AI Analysis"
              description="Vocabulary, grammar, and context extracted automatically by AI."
            />
            <FeatureCard
              icon={<GraduationCap className="h-6 w-6" />}
              title="Interactive Quizzes"
              description="Multiple choice, fill-in-blank, word arrange, listening & more."
            />
            <FeatureCard
              icon={<Mic className="h-6 w-6" />}
              title="AI Conversation"
              description="Practice speaking with an AI tutor that adapts to your level."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-b py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground">
              How It Works
            </h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <StepCard
              step={1}
              icon={<Youtube className="h-8 w-8 text-primary" />}
              title="Find a Video"
              description="Search for any YouTube video in the language you're learning."
            />
            <StepCard
              step={2}
              icon={<BookOpen className="h-8 w-8 text-primary" />}
              title="AI Creates Your Lesson"
              description="Our AI extracts transcripts, vocabulary, grammar, and builds structured learning units."
            />
            <StepCard
              step={3}
              icon={<MessageCircle className="h-8 w-8 text-primary" />}
              title="Learn & Practice"
              description="Take quizzes, practice sentences, and have AI conversations to solidify your skills."
            />
          </div>
        </div>
      </section>

      {/* iOS App Promo */}
      <section className="border-b py-20">
        <div className="container mx-auto px-4">
          <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-accent/20 to-primary/5 p-8 md:p-12">
            <div className="grid items-center gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-foreground">
                  Take It On the Go
                </h2>
                <p className="text-muted-foreground">
                  BreakLingo is also available on iOS. Learn anywhere, anytime with our native mobile app.
                </p>
                <div className="space-y-2">
                  {["Offline-ready lessons", "Native speech recognition", "Seamless sync across devices"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {item}
                    </div>
                  ))}
                </div>
                <a
                  href="https://apps.apple.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="lg" className="mt-4 gap-2">
                    Download on App Store
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
              </div>
              <div className="flex justify-center">
                <img
                  src={AVATAR_URL}
                  alt="BreakLingo mobile"
                  className="w-48 drop-shadow-lg md:w-56"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8">
        <div className="container mx-auto flex flex-col items-center gap-4 px-4 text-center">
          <div className="flex items-center gap-2">
            <img src={AVATAR_URL} alt="BreakLingo" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-bold text-foreground">BreakLingo</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} BreakLingo. Learn languages from real videos.
          </p>
        </div>
      </footer>
    </div>
  );
};

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="border bg-card transition-shadow hover:shadow-md">
      <CardContent className="space-y-3 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function StepCard({ step, icon, title, description }: { step: number; icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        {icon}
      </div>
      <div className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {step}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default Landing;

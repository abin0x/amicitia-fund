import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Landmark, ShieldCheck, WalletCards } from "lucide-react";

const slides = [
  {
    title: "Manage everything in one place",
    description: "Track members, payments, and monthly activity from one clean mobile workspace.",
    icon: Landmark,
  },
  {
    title: "Submit and review payments faster",
    description: "Use a guided payment flow and keep transaction records organized without extra steps.",
    icon: WalletCards,
  },
  {
    title: "Watch progress with simple insights",
    description: "See collections, pending amounts, and trends through compact mobile-first dashboards.",
    icon: BarChart3,
  },
  {
    title: "Built for members and admins",
    description: "Switch between member and admin tasks with a clear, secure, and easy-to-use experience.",
    icon: ShieldCheck,
  },
];

export default function OnboardingScreen({ onFinish }: { onFinish: () => void }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const isLastSlide = activeSlide === slides.length - 1;
  const ActiveIcon = slides[activeSlide].icon;

  const goNext = () => {
    if (isLastSlide) {
      onFinish();
      return;
    }
    setActiveSlide((current) => current + 1);
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-[linear-gradient(180deg,#f7fbf8_0%,#f3f8f5_100%)]">
      <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top,rgba(20,102,76,0.10),transparent_72%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 pb-8 pt-10">
        <div className="flex items-center justify-between">
          <img src="/amicitia-logo.png" alt="Amicitia logo" className="theme-logo h-11 w-auto max-w-[190px] object-contain" />
          <button
            type="button"
            onClick={onFinish}
            className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <div className="rounded-[28px] border border-border/60 bg-background/88 p-6 shadow-[0_14px_36px_rgba(16,24,40,0.08)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-primary/10 text-primary">
              <ActiveIcon className="h-6 w-6" />
            </div>

            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/65">
                Step {activeSlide + 1} of {slides.length}
              </p>
              <h1 className="mt-3 text-[1.9rem] font-bold tracking-tight text-foreground">
                {slides[activeSlide].title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {slides[activeSlide].description}
              </p>
            </div>

            <div className="mt-7 flex gap-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveSlide(index)}
                  className={`h-2.5 rounded-full transition-all ${
                    index === activeSlide ? "w-7 bg-primary" : "w-2.5 bg-primary/20"
                  }`}
                  aria-label={`Show onboarding slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            onClick={goNext}
            className="h-12 w-full rounded-2xl text-base font-semibold shadow-[0_14px_28px_rgba(20,102,76,0.16)]"
          >
            {isLastSlide ? "Get Started" : "Next"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          {activeSlide > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveSlide((current) => current - 1)}
              className="h-11 w-full rounded-2xl"
            >
              Back
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

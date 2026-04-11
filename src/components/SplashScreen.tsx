export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[radial-gradient(circle_at_top,#effaf4_0%,#edf6f2_38%,#f8fbfa_100%)]">
      <div className="absolute inset-x-0 top-[-10%] h-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-[-12%] right-[-8%] h-72 w-72 rounded-full bg-accent/15 blur-3xl" />

      <div className="relative flex min-h-screen flex-col items-center justify-center px-8 text-center">
        <img
          src="/app-icon.png"
          alt="Amicitia app icon"
          className="mb-6 h-24 w-24 animate-[pulse_2.4s_ease-in-out_infinite] rounded-[28px] object-contain shadow-[0_20px_40px_rgba(15,23,42,0.18)]"
        />

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-primary/65">Premium Mobile</p>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Amicitia</h1>
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">
            A refined, mobile-first investment workspace for members and administrators.
          </p>
        </div>

        <div className="mt-10 flex gap-2">
          <span className="h-2.5 w-10 rounded-full bg-primary" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary/25" />
        </div>
      </div>
    </div>
  );
}

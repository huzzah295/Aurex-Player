interface AudioLogoViewProps {
  title: string;
  playing: boolean;
}

/**
 * Shown instead of the native video surface when the loaded track has no
 * video stream (mp3, flac, etc.) - without this the screen is just flat
 * black with only audio, which reads as broken rather than intentional.
 */
export function AudioLogoView({ title, playing }: AudioLogoViewProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-3xl bg-[rgb(var(--accent))] shadow-[0_0_40px_-8px_rgb(var(--accent)/0.6)] ${
          playing ? "animate-aurex-breathe" : ""
        }`}
      >
        <div className="flex h-6 items-end gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`w-1.5 rounded-full bg-white/90 ${playing ? "animate-aurex-eq" : ""}`}
              style={{
                height: playing ? "100%" : "6px",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="flex max-w-xs flex-col items-center gap-1 text-center">
        <p className="truncate text-sm font-medium text-[rgb(var(--text))]">{title}</p>
        <p className="text-xs text-[rgb(var(--text-muted))]">Audio Playback</p>
      </div>
    </div>
  );
}

import type { VideoEqProperty } from "../../stores/videoEqStore";

export const VIDEO_ADJUST_FIELDS: { property: VideoEqProperty; label: string }[] = [
  { property: "brightness", label: "Brightness" },
  { property: "contrast", label: "Contrast" },
  { property: "saturation", label: "Saturation" },
  { property: "gamma", label: "Gamma" },
  { property: "hue", label: "Tint" },
];

interface VideoAdjustSlidersProps {
  values: Record<VideoEqProperty, number>;
  onChange: (property: VideoEqProperty, value: number) => void;
  onReset: () => void;
}

/** The actual slider panel content, shared between the trigger button's
 * host window and the dedicated overlay window that displays it. */
export function VideoAdjustSliders({ values, onChange, onReset }: VideoAdjustSlidersProps) {
  return (
    <div className="glass-panel flex h-full w-full flex-col rounded-lg border border-[rgb(var(--border))] p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[rgb(var(--text))]">Video Adjustments</span>
        <button
          onClick={onReset}
          className="glass-btn cursor-pointer text-xs text-[rgb(var(--text-muted))] transition-colors duration-150 hover:text-[rgb(var(--accent))]"
        >
          Reset
        </button>
      </div>
      <div className="flex flex-col gap-2.5">
        {VIDEO_ADJUST_FIELDS.map(({ property, label }) => (
          <div key={property} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-[rgb(var(--text-muted))]">
              <span>{label}</span>
              <span className="tabular-nums">{values[property]}</span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              value={values[property]}
              onChange={(e) => onChange(property, Number(e.target.value))}
              className="aurex-range w-full"
              style={{ ["--progress" as string]: `${((values[property] + 100) / 200) * 100}%` }}
              aria-label={label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

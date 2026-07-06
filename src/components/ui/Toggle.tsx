import { motion } from "framer-motion";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/**
 * Shared switch control - previously EqualizerSettings had its own inline
 * version while AdvancedSettings/SettingsDialog used raw checkboxes, so the
 * same on/off concept looked different in three places.
 */
export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`glass-btn relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-200 disabled:cursor-default disabled:opacity-40 ${
        checked
          ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent))]"
          : "border-[rgb(var(--border))] bg-transparent hover:border-[rgb(var(--text-muted))]"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={`absolute top-[3px] h-3.5 w-3.5 rounded-full shadow-sm ${
          checked ? "left-[19px] bg-white" : "left-[3px] bg-[rgb(var(--text-muted))]"
        }`}
      />
    </button>
  );
}

/** Label + Toggle row, matching the settings-list pattern used across every tab. */
export function ToggleField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-[rgb(var(--text-muted))]">
      <span>{label}</span>
      <Toggle checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}

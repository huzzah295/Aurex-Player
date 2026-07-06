import { useState } from "react";
import { motion, type Variants } from "framer-motion";
import { useEqualizerStore } from "../../stores/equalizerStore";
import { playbackService } from "../../services/playbackService";
import { BUILTIN_EQ_PRESETS, EQ_FREQUENCIES, formatEqFrequency } from "../../lib/equalizerPresets";
import { CloseIcon } from "../icons";
import { Toggle } from "../ui/Toggle";

const chipList: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

const chipItem: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.15, ease: "easeOut" } },
};

export function EqualizerSettings() {
  const enabled = useEqualizerStore((s) => s.enabled);
  const bands = useEqualizerStore((s) => s.bands);
  const activePresetName = useEqualizerStore((s) => s.activePresetName);
  const customPresets = useEqualizerStore((s) => s.customPresets);
  const setEnabled = useEqualizerStore((s) => s.setEnabled);
  const setBand = useEqualizerStore((s) => s.setBand);
  const applyPreset = useEqualizerStore((s) => s.applyPreset);
  const saveCustomPreset = useEqualizerStore((s) => s.saveCustomPreset);
  const deleteCustomPreset = useEqualizerStore((s) => s.deleteCustomPreset);
  const [newPresetName, setNewPresetName] = useState("");

  const handleToggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    void playbackService.setEqualizer(bands, next);
  };

  const handlePreset = (name: string) => {
    const presetBands = BUILTIN_EQ_PRESETS.find((p) => p.name === name)?.bands ?? customPresets[name];
    if (!presetBands) return;
    applyPreset(name);
    void playbackService.setEqualizer(presetBands, enabled);
  };

  const handleBandChange = (index: number, value: number) => {
    setBand(index, value);
    const nextBands = [...bands];
    nextBands[index] = value;
    void playbackService.setEqualizer(nextBands, enabled);
  };

  const handleSavePreset = () => {
    const name = newPresetName.trim();
    if (!name) return;
    saveCustomPreset(name);
    setNewPresetName("");
  };

  const customPresetNames = Object.keys(customPresets);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Equalizer</h2>
        <Toggle checked={enabled} onChange={handleToggleEnabled} label="Enable equalizer" />
      </div>

      <motion.div variants={chipList} initial="hidden" animate="visible" className="flex flex-wrap gap-1.5">
        {BUILTIN_EQ_PRESETS.map((preset) => (
          <motion.div key={preset.name} variants={chipItem}>
            <PresetChip
              label={preset.name}
              active={activePresetName === preset.name}
              onClick={() => handlePreset(preset.name)}
            />
          </motion.div>
        ))}
        {customPresetNames.map((name) => (
          <motion.div key={name} variants={chipItem}>
            <PresetChip
              label={name}
              active={activePresetName === name}
              onClick={() => handlePreset(name)}
              onRemove={() => deleteCustomPreset(name)}
            />
          </motion.div>
        ))}
      </motion.div>

      <div
        className={`flex items-end justify-between gap-2 rounded-md border border-[rgb(var(--border))] px-3 pb-3 pt-4 transition-opacity duration-150 ${
          enabled ? "" : "opacity-40"
        }`}
      >
        {EQ_FREQUENCIES.map((freq, index) => (
          <BandSlider
            key={freq}
            label={formatEqFrequency(freq)}
            value={bands[index] ?? 0}
            disabled={!enabled}
            onChange={(value) => handleBandChange(index, value)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newPresetName}
          onChange={(e) => setNewPresetName(e.target.value)}
          placeholder="Custom preset name"
          maxLength={40}
          className="flex-1 rounded-md border border-[rgb(var(--border))] bg-transparent px-3 py-1.5 text-sm text-[rgb(var(--text))] outline-none focus:border-[rgb(var(--accent))]"
        />
        <button
          onClick={handleSavePreset}
          disabled={!newPresetName.trim()}
          className="glass-btn cursor-pointer rounded-md border border-[rgb(var(--border))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--text))] transition-colors duration-150 hover:bg-[rgb(var(--bg-hover))] disabled:cursor-default disabled:opacity-50"
        >
          Save Preset
        </button>
      </div>
    </div>
  );
}

function PresetChip({
  label,
  active,
  onClick,
  onRemove,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border pl-2.5 pr-1 py-1 text-xs transition-colors duration-150 ${
        active
          ? "border-[rgb(var(--accent))] text-[rgb(var(--accent))]"
          : "border-[rgb(var(--border))] text-[rgb(var(--text-muted))]"
      }`}
    >
      <button onClick={onClick} className="glass-btn cursor-pointer rounded px-0.5 hover:text-[rgb(var(--text))]">
        {label}
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Delete ${label}`}
          className="flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded-full text-[rgb(var(--text-muted))] hover:text-[rgb(var(--danger))]"
        >
          <CloseIcon className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

function BandSlider({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <span className="text-[10px] tabular-nums text-[rgb(var(--text-muted))]">
        {value > 0 ? `+${value}` : value}
      </span>
      <input
        type="range"
        min={-20}
        max={20}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="aurex-range-vertical h-24"
        style={{ writingMode: "vertical-lr", direction: "rtl" }}
        aria-label={`${label} band gain`}
      />
      <span className="text-[10px] text-[rgb(var(--text-muted))]">{label}</span>
    </div>
  );
}

import { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { SelectPill } from "../ui/SelectPill";
import { ToggleField } from "../ui/Toggle";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

interface AdvancedConfig {
  hwdec: string;
  demuxerMaxBytes: string;
  vo: string;
  loggingEnabled: boolean;
  experimentalFeatures: boolean;
}

const DEFAULT_CONFIG: AdvancedConfig = {
  hwdec: "auto-safe",
  demuxerMaxBytes: "150MiB",
  vo: "gpu-next",
  loggingEnabled: false,
  experimentalFeatures: false,
};

const HWDEC_OPTIONS: { value: string; label: string }[] = [
  { value: "auto-safe", label: "Auto (Safe)" },
  { value: "auto", label: "Auto" },
  { value: "no", label: "Off (Software)" },
];

const BUFFER_OPTIONS: { value: string; label: string }[] = [
  { value: "150MiB", label: "150 MB" },
  { value: "300MiB", label: "300 MB" },
  { value: "600MiB", label: "600 MB" },
];

const RENDERER_OPTIONS: { value: string; label: string }[] = [
  { value: "gpu-next", label: "Auto (Recommended)" },
  { value: "gpu", label: "Compatibility" },
];

export function AdvancedSettings() {
  const [config, setConfig] = useState<AdvancedConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [restartNeeded, setRestartNeeded] = useState(false);

  useEffect(() => {
    if (!isTauri) return;
    (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<AdvancedConfig>("get_advanced_config");
      setConfig(result);
      setLoaded(true);
    })();
  }, []);

  const persist = async (next: AdvancedConfig) => {
    if (!isTauri) return;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_advanced_config", { config: next });
  };

  const applyLive = async (property: "hwdec" | "demuxer-max-bytes", value: string) => {
    if (!isTauri) return;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("mpv_set_pro_property", { property, value });
  };

  const handleHwdecChange = (hwdec: string) => {
    const next = { ...config, hwdec };
    setConfig(next);
    void persist(next);
    void applyLive("hwdec", hwdec);
  };

  const handleBufferChange = (demuxerMaxBytes: string) => {
    const next = { ...config, demuxerMaxBytes };
    setConfig(next);
    void persist(next);
    void applyLive("demuxer-max-bytes", demuxerMaxBytes);
  };

  const handleRendererChange = (vo: string) => {
    const next = { ...config, vo };
    setConfig(next);
    void persist(next);
    setRestartNeeded(true);
  };

  const handleLoggingChange = (loggingEnabled: boolean) => {
    const next = { ...config, loggingEnabled };
    setConfig(next);
    void persist(next);
    setRestartNeeded(true);
  };

  const handleExperimentalChange = (experimentalFeatures: boolean) => {
    const next = { ...config, experimentalFeatures };
    setConfig(next);
    void persist(next);
  };

  if (!loaded) {
    return (
      <div className="flex flex-col gap-5 p-6">
        <h2 className="text-base font-semibold">Advanced</h2>
        <p className="text-sm text-[rgb(var(--text-muted))]">Loading...</p>
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="visible" className="flex flex-col gap-5 p-6">
      <motion.h2 variants={item} className="text-base font-semibold">Advanced</motion.h2>
      <motion.p variants={item} className="text-sm text-[rgb(var(--text-muted))]">
        These settings affect playback internals directly. Defaults work well for almost everyone.
      </motion.p>

      <motion.div variants={item}>
        <Field label="Hardware Acceleration">
          <OptionRow options={HWDEC_OPTIONS} value={config.hwdec} onChange={handleHwdecChange} />
        </Field>
      </motion.div>

      <motion.div variants={item}>
        <Field label="Playback Buffer Size">
          <OptionRow options={BUFFER_OPTIONS} value={config.demuxerMaxBytes} onChange={handleBufferChange} />
        </Field>
      </motion.div>

      <motion.div variants={item}>
        <Field label="Renderer (applies after restart)">
          <OptionRow options={RENDERER_OPTIONS} value={config.vo} onChange={handleRendererChange} />
        </Field>
      </motion.div>

      <motion.div variants={item}>
        <Field label="Diagnostic Logging (applies after restart)">
          <ToggleField
            label="Write logs to disk for troubleshooting"
            checked={config.loggingEnabled}
            onChange={handleLoggingChange}
          />
        </Field>
      </motion.div>

      <motion.div variants={item}>
        <Field label="Experimental Features">
          <ToggleField
            label="Reserved for future use - currently has no effect"
            checked={config.experimentalFeatures}
            onChange={handleExperimentalChange}
          />
        </Field>
      </motion.div>

      {restartNeeded && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-[rgb(var(--text-muted))]"
        >
          Restart Aurex Player for this change to take effect.
        </motion.p>
      )}
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-[rgb(var(--text-muted))]">{label}</label>
      {children}
    </div>
  );
}

function OptionRow({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <SelectPill key={option.value} active={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </SelectPill>
      ))}
    </div>
  );
}

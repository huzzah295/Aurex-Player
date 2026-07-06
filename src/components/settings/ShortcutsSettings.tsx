import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useSettingsStore } from "../../stores/settingsStore";
import { SHORTCUT_ACTIONS, SHORTCUT_LABELS, comboFromEvent, formatShortcut, MODIFIER_ONLY_CODES, type ShortcutAction } from "../../lib/shortcuts";
import { SelectPill } from "../ui/SelectPill";

const list: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.02 } },
};

const row: Variants = {
  hidden: { opacity: 0, x: -6 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.16, ease: "easeOut" } },
};

export function ShortcutsSettings() {
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const setShortcut = useSettingsStore((s) => s.setShortcut);
  const resetShortcuts = useSettingsStore((s) => s.resetShortcuts);
  const [listening, setListening] = useState<ShortcutAction | null>(null);

  useEffect(() => {
    if (!listening) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === "Escape") {
        e.stopPropagation();
        setListening(null);
        return;
      }
      if (MODIFIER_ONLY_CODES.has(e.code)) return;
      setShortcut(listening, comboFromEvent(e));
      setListening(null);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [listening, setShortcut]);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
        <button
          onClick={() => resetShortcuts()}
          className="cursor-pointer text-xs text-[rgb(var(--text-muted))] transition-colors duration-150 hover:text-[rgb(var(--accent))]"
        >
          Reset all to defaults
        </button>
      </div>
      <motion.div variants={list} initial="hidden" animate="visible" className="flex flex-col gap-1">
        {SHORTCUT_ACTIONS.map((action) => (
          <motion.div
            key={action}
            variants={row}
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-[rgb(var(--bg-hover))]"
          >
            <span className="text-[rgb(var(--text))]">{SHORTCUT_LABELS[action]}</span>
            <SelectPill
              active={listening === action}
              onClick={() => setListening(action)}
              size="xs"
              className="min-w-[110px] text-center"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={listening === action ? "listening" : shortcuts[action]}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="inline-block tabular-nums"
                >
                  {listening === action ? "Press a key…" : formatShortcut(shortcuts[action])}
                </motion.span>
              </AnimatePresence>
            </SelectPill>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

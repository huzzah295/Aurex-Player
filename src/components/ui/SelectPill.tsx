import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface SelectPillProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  size?: "sm" | "xs";
  tabularNums?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<SelectPillProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-sm",
  xs: "px-3 py-1 text-xs",
};

/**
 * Shared "outlined selectable pill" control - the same accent-border-when-active
 * pattern was independently reimplemented (with no hover feedback or glass-theme
 * support) for theme/skip-interval pickers, AdvancedSettings' OptionRow, and the
 * shortcuts key-combo button. One component now backs all of them.
 */
export function SelectPill({ active, onClick, children, size = "sm", tabularNums, className = "" }: SelectPillProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      aria-pressed={active}
      className={`glass-btn rounded-md border transition-colors duration-150 ${SIZE_CLASSES[size]} ${
        tabularNums ? "tabular-nums" : ""
      } ${
        active
          ? "border-[rgb(var(--accent))] text-[rgb(var(--accent))]"
          : "border-[rgb(var(--border))] text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text))]"
      } ${className}`}
    >
      {children}
    </motion.button>
  );
}

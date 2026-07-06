import { motion, type Variants } from "framer-motion";
import { useSettingsStore } from "../stores/settingsStore";

const container: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export function Onboarding() {
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="flex flex-1 flex-col items-center justify-center gap-6 bg-[rgb(var(--bg))] text-center"
    >
      <motion.div variants={item} className="h-14 w-14 rounded-2xl bg-[rgb(var(--accent))]" />
      <motion.div variants={item}>
        <h1 className="text-2xl font-semibold">Welcome to Aurex Player</h1>
        <p className="mt-2 text-sm text-[rgb(var(--text-muted))]">
          Built for speed. Designed for everyone.
        </p>
      </motion.div>
      <motion.button
        variants={item}
        onClick={completeOnboarding}
        whileTap={{ scale: 0.96 }}
        className="rounded-full bg-[rgb(var(--accent))] px-6 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Get Started
      </motion.button>
      <motion.p variants={item} className="text-xs text-[rgb(var(--text-muted))]">
        Created by Muhammad Huzaifa Saeed &middot; &copy; 2026
      </motion.p>
    </motion.div>
  );
}

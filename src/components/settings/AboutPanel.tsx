import { motion, type Variants } from "framer-motion";

const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

export function AboutPanel() {
  return (
    <motion.div variants={container} initial="hidden" animate="visible" className="flex flex-col gap-3 p-6 text-sm">
      <motion.h2 variants={item} className="text-lg font-semibold">
        Aurex Player
      </motion.h2>
      <motion.p variants={item} className="text-[rgb(var(--text-muted))]">
        Premium Lightweight Media Player
      </motion.p>
      <motion.p variants={item} className="text-[rgb(var(--text-muted))]">
        Version 1.0.0
      </motion.p>
      <motion.p variants={item} className="text-[rgb(var(--text-muted))]">
        Created by Muhammad Huzaifa Saeed
      </motion.p>
      <motion.p variants={item} className="text-[rgb(var(--text-muted))]">
        &copy; 2026 Muhammad Huzaifa Saeed
      </motion.p>
      <motion.p variants={item} className="text-[rgb(var(--text-muted))]">
        First Release: 2026
      </motion.p>
      <motion.p variants={item} className="mt-2 max-w-md leading-relaxed text-[rgb(var(--text-muted))]">
        Aurex Player is a modern, lightweight, high-performance media player designed to
        deliver a premium viewing and listening experience on both low-end and high-end
        Windows PCs.
      </motion.p>
    </motion.div>
  );
}

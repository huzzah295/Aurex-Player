import { useEffect, useRef } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { openFilesDialog, openFolderDialog } from "../../lib/openMedia";
import { useUiStore } from "../../stores/uiStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { suppressNextSurfaceClick } from "../../lib/surfaceClickGuard";
import {
  CheckIcon,
  EqualizerIcon,
  FileIcon,
  FolderOpenIcon,
  InfoIcon,
  KeyboardIcon,
  LogOutIcon,
  MenuIcon,
  SettingsIcon,
} from "../icons";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const menuList: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.025, delayChildren: 0.03 } },
};

const menuListItem: Variants = {
  hidden: { opacity: 0, x: -4 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.12, ease: "easeOut" } },
};

async function closeWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().close();
}

interface AppMenuProps {
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenEqualizer: () => void;
  onOpenAbout: () => void;
}

export function AppMenu({ onOpenSettings, onOpenShortcuts, onOpenEqualizer, onOpenAbout }: AppMenuProps) {
  const open = useUiStore((s) => s.menuOpen);
  const setOpen = useUiStore((s) => s.setMenuOpen);
  const alwaysOnTop = useSettingsStore((s) => s.alwaysOnTop);
  const setAlwaysOnTop = useSettingsStore((s) => s.setAlwaysOnTop);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        // This same interaction's trailing `click` must only close the
        // menu, never also toggle play/pause on whatever was underneath
        // (see surfaceClickGuard.ts).
        suppressNextSurfaceClick();
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, setOpen]);

  const runAndClose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="glass-btn flex h-9 w-9 items-center justify-center text-[rgb(var(--text-muted))] transition-colors duration-150 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text))]"
        aria-label="Menu"
        aria-expanded={open}
      >
        <MenuIcon className="h-[17px] w-[17px]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{ transformOrigin: "top left" }}
            className="glass-panel absolute left-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-xl border border-[rgb(var(--border))] p-1.5 text-[13px] shadow-xl"
          >
            <motion.div variants={menuList} initial="hidden" animate="visible">
              <MenuItem icon={<FileIcon className="h-4 w-4" />} label="Open File…" onClick={() => runAndClose(() => void openFilesDialog())} />
              <MenuItem icon={<FolderOpenIcon className="h-4 w-4" />} label="Open Folder…" onClick={() => runAndClose(() => void openFolderDialog())} />
              <MenuDivider />
              <MenuItem icon={<SettingsIcon className="h-4 w-4" />} label="Settings" onClick={() => runAndClose(onOpenSettings)} />
              <MenuItem icon={<EqualizerIcon className="h-4 w-4" />} label="Equalizer" onClick={() => runAndClose(onOpenEqualizer)} />
              <MenuItem icon={<KeyboardIcon className="h-4 w-4" />} label="Keyboard Shortcuts" onClick={() => runAndClose(onOpenShortcuts)} />
              <MenuItem icon={<InfoIcon className="h-4 w-4" />} label="About Aurex Player" onClick={() => runAndClose(onOpenAbout)} />
              {isTauri && (
                <>
                  <MenuDivider />
                  <MenuItem
                    icon={alwaysOnTop ? <CheckIcon className="h-4 w-4" /> : null}
                    label="Always on Top"
                    onClick={() => runAndClose(() => setAlwaysOnTop(!alwaysOnTop))}
                    role="menuitemcheckbox"
                    checked={alwaysOnTop}
                  />
                </>
              )}
              {isTauri && (
                <>
                  <MenuDivider />
                  <MenuItem icon={<LogOutIcon className="h-4 w-4" />} label="Exit" onClick={() => runAndClose(() => void closeWindow())} />
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuDivider() {
  return <div className="my-1.5 border-t border-[rgb(var(--border))]" />;
}

function MenuItem({
  icon,
  label,
  onClick,
  role = "menuitem",
  checked,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  role?: "menuitem" | "menuitemcheckbox";
  checked?: boolean;
}) {
  return (
    <motion.button
      variants={menuListItem}
      role={role}
      aria-checked={role === "menuitemcheckbox" ? checked : undefined}
      onClick={onClick}
      className="glass-btn flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[rgb(var(--text))] transition-colors duration-150 hover:bg-[rgb(var(--bg-hover))] active:scale-[0.98]"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[rgb(var(--text-muted))]">{icon}</span>
      <span className="truncate">{label}</span>
    </motion.button>
  );
}

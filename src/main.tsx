import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Applies the persisted theme/accent to `document.documentElement` as a
// module-load side effect (see settingsStore.ts). Every window (main, the
// video-adjust popover, the fullscreen control bar) needs this - importing
// it unconditionally here, rather than relying on each window's own
// component tree happening to import the store, guarantees all of them
// pick up e.g. the Liquid Glass theme consistently.
import './stores/settingsStore'
import App from './App.tsx'
import { VideoAdjustPopoverWindow } from './windows/VideoAdjustPopoverWindow.tsx'
import { FullscreenControlsWindow } from './windows/FullscreenControlsWindow.tsx'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

function renderForLabel(label: string) {
  switch (label) {
    case 'video-adjust-popover':
      return <VideoAdjustPopoverWindow />
    case 'fullscreen-controls':
      return <FullscreenControlsWindow />
    default:
      return <App />
  }
}

async function bootstrap() {
  let label = 'main'
  if (isTauri) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    label = getCurrentWindow().label
  }
  document.documentElement.dataset.window = label

  createRoot(document.getElementById('root')!).render(
    <StrictMode>{renderForLabel(label)}</StrictMode>,
  )
}

void bootstrap()

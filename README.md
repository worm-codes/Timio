# Timio

A Pomodoro timer desktop app with pixel pet companions. Built with Electron, React, and TypeScript.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-28.3-47848F.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://reactjs.org/)

---

## Why This Exists

I wanted a Pomodoro timer that actually makes you want to use it. Most timers feel clinical and boring. This one has pixel pets that react to your work sessions - they walk around when you're working, sleep during breaks, and celebrate when you finish.

The idle detection was crucial for me. If I step away from my computer, the timer should pause automatically and not waste my work time. Voice detection helps too - if I'm talking on a call, the timer won't auto-pause.

---

## What It Does

**Core Timer**
- Standard Pomodoro: 25-minute work sessions, 5-minute breaks (both customizable)
- Timer runs in the main process, so it's reliable even if the UI lags
- Auto-starts break when work finishes

**Idle Detection**
- Monitors system activity through native OS APIs
- Pauses timer after 5 minutes of inactivity
- Deducts idle time from your work session
- Ignores voice activity (keeps running if you're on a call)

**Pixel Pets**
- 8 different animals (dogs, cats, rats, birds)
- Canvas-based sprite animations
- Follow your mouse around
- Click them for affection points
- Their behavior changes based on timer state

**Break Notifications**
- Window pops to front when break starts
- System beep sound
- Returns to normal after break

**Sounds**
- Procedural audio using Tone.js (no audio files)
- Different melodies for start, pause, complete, etc.
- Can be toggled off

---

## How It Works

The app has three main processes:

**Main Process** (Electron)
- Runs the timer state machine
- Handles idle detection via `powerMonitor.getSystemIdleTime()`
- Manages IPC communication with renderer

**Preload Script**
- Secure bridge between main and renderer
- Exposes only necessary APIs via `contextBridge`

**Renderer Process** (React)
- UI components and pet animations
- Canvas rendering for pixel sprites
- Voice detection using Web Audio API

Timer state machine has 7 states:
- `STOPPED` → `RUNNING` → `PAUSED` → `RUNNING` → `WORK_FINISHED` → `BREAK_RUNNING` → `BREAK_FINISHED` → `STOPPED`
- Special `IDLE_PAUSED` state for automatic pausing

Pet animations are sprite sheets loaded via IPC. The main process reads PNG files from `extraResources` and returns base64 data URIs to avoid Chromium's file:// protocol restrictions in production builds.

---

## Tech Stack

- **Electron 28** - Desktop framework
- **React 18** - UI library
- **TypeScript 5** - Type safety
- **Vite** - Build tool
- **Tone.js** - Sound synthesis
- **Canvas API** - Pet rendering

Build system uses electron-builder with NSIS for Windows, DMG for macOS, AppImage for Linux.

---

## Installation

### Download
[Get the latest release](https://github.com/worm-codes/Timio/releases)

Windows: `.exe` (portable, no installation needed)  
macOS: `.dmg` (coming soon)  
Linux: `.AppImage` (coming soon)

### Build from Source

```bash
# Clone
git clone https://github.com/worm-codes/Timio.git
cd Timio

# Install dependencies
npm install

# Run in development
npm run electron:dev

# Build for production
npm run build
npx electron-builder --win portable
```

**Note**: Windows builds require admin privileges on first run for code signing setup.

---

## Usage

1. Start the app
2. Pick a pixel pet (click the settings icon)
3. Click "IGNITE" to start a 25-minute work session
4. Pet walks around while you work
5. Timer auto-pauses if you're idle for 5+ minutes
6. After 25 minutes, break starts automatically
7. Pet sleeps during break
8. Click "QUENCH" to pause anytime

Settings:
- Work/break duration
- IProject Structure

```
src/
├── main/
│   ├── index.ts          # Main process, window management
│   ├── TimerEngine.ts    # Timer state machine
│   └── IdleDetector.ts   # System idle monitoring
├── preload/
│   └── preload.ts        # IPC bridge
└── renderer/
    ├── App.tsx           # React root
    ├── components/       # UI components
    ├── hooks/            # Custom React hooks
    ├── SoundManager.ts   # Tone.js wrapper
    └── PixelPet/         # Pet animation system
        ├── SpriteLoader.ts
        ├── AnimationController.ts
        └── PixelPet.tsx
```

---

## Development Notes

The trickiest part was asset loading in production. Electron's security model blocks `file://` URLs in packaged apps, so sprite sheets wouldn't load. Solution: IPC handler in main process reads files from `extraResources`, returns base64 data URIs. Renderer caches these as `HTMLImageElement` objects.

Folder names with spaces (like "7 Bird") required `encodeURI()` in renderer and `decodeURIComponent()` in main process handler.

Voice detection uses Web Audio API to analyze microphone input. It measures volume in dBFS and compares against a threshold. Consecutive checks (3 for voice, 6 for silence) prevent false triggers.

---

## License

MIT License - see [LICENSE](LICENSE) file

---

## Credits

Pixel art sprites: [Pixel Frog on itch.io](https://pixelfrog-assets.itch.io/)  
Font: Future Millennium by [Pizzadude](https://www.dafont.com/future-millennium.font)

---

**Made with focus (and a pixel rat companion)
- [ ] Customizable keyboard shortcuts
- [ ] Export/import settings
- [ ] Session history with calendar view

---

**Built with ❤️ and a warm campfire glow**

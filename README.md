# 🍊 Tangerine for Windows

Hold **Shift**, drag any file, release it on an action. Tangerine converts and edits images, video, audio, PDFs and documents **100 % locally** — nothing is uploaded, there is no telemetry.

A Windows take on the Mac app *Tangerine*: a glass radial menu that appears under your cursor, in the spirit of Raycast and macOS Quick Actions. There are no onboarding screens.

---

## Share it with friends: no scripts, browser only

The repository includes a cloud build (in the .github/workflows folder) that turns this source into a finished Windows installer on GitHub's servers.

1. Create a free account at github.com, then click **New repository**. Name it `tangerine-windows`, make it **Public**, and create it.
2. On the empty repository page, click **uploading an existing file**. Drag in **everything inside** the `tangerine-windows` folder, then click **Commit changes**.
   *If the browser skips the hidden `.github` folder:* click **Add file > Create new file**, type the name `.github/workflows/build-windows.yml`, paste in that file's contents, and commit.
3. Open the **Actions** tab. The *Build Windows app* job starts automatically and takes about 10-15 minutes.
4. Open **Releases** on the right of the repository page. Download `Tangerine-Setup-...-x64.exe`, or send your friends the release link.

Your friends just double-click the Setup file. Because the app isn't code-signed, Windows SmartScreen asks once: they click **More info**, then **Run anyway**. FFmpeg, ImageMagick, Ghostscript, qpdf and Pandoc are all built in. Only *Documents to PDF* also needs the free LibreOffice installed.

---

## How it works

| You do | Tangerine does |
|---|---|
| Hold **Shift** and drag a file 20 px (Explorer or Desktop) | A radial menu appears under the cursor in under 100 ms |
| Move over a segment | It highlights, and the centre shows what it will do. Hovering **Edit** or **More** opens a second ring |
| Release on a segment | The conversion runs in the background. The menu shrinks to a small progress ring |
| Done | The result is saved next to your other files as `name_converted.ext` (on the Desktop by default) |
| Hold **Ctrl+Shift** and drag several files | Batch mode: the action runs on every file. **Merge PDFs** combines them into one |
| Right-click a file → **Convert with Tangerine** | The same menu opens, driven by keyboard (← → to move between segments, ↑ ↓ to move between rings, Enter to run, Esc to close) |

**Ring layout:** centre = status and progress · inner ring = your 4 **Favorites** · main ring = conversions and an **Edit** group · outer ring = the submenu.

### MVP actions (20)

| Kind | Actions | Engine |
|---|---|---|
| Image (JPG PNG WEBP HEIC TIFF GIF BMP SVG) | → PNG, → JPG, → WEBP, Compress, Resize 50 %, Rotate 90° | ImageMagick 7 |
| Video (MP4 MOV AVI MKV WEBM) | → MP4 (H.264), → GIF, Compress (≤1080p), Extract audio (MP3), Extract frame (PNG) | FFmpeg |
| Audio (MP3 WAV AAC FLAC OGG M4A) | → MP3, → WAV, → M4A, → FLAC | FFmpeg |
| PDF | Compress, Export pages as PNG, Merge (2+ files) | Ghostscript, qpdf |
| Document (DOCX TXT RTF MD) | → PDF, → Markdown | LibreOffice, Pandoc |

Every action respects the **Quality preset** (High, Balanced or Smallest). The preset maps to the JPEG/WebP quality, the x264 CRF, the audio bitrate and the Ghostscript `PDFSETTINGS`.

---

## Build instructions

### Prerequisites
- Windows 10 22H2 or Windows 11 (x64)
- Node.js 20 LTS or later, and Git
- *(optional, for PDF and document actions)* Ghostscript and LibreOffice. `npm run fetch:bin -- --system-deps` installs both with winget.

### Steps

```powershell
git clone <your-repo> tangerine-windows
cd tangerine-windows
npm install                 # also rebuilds the uiohook-napi native hook for Electron
npm run fetch:bin           # downloads FFmpeg, ImageMagick, qpdf, Pandoc into resources/bin
#   or only FFmpeg:  npm run fetch:ffmpeg
npm run dev                 # run with hot reload (tray icon appears; Shift-drag a file)
```

### Build the installer and portable .exe

```powershell
npm run dist                # typecheck → build → verify binaries → NSIS installer + portable exe
#   npm run dist:installer   (NSIS only)
#   npm run dist:portable    (portable only)
#   npm run dist:dir         (unpacked folder, quickest for testing)
```

The artifacts are written to `release/`:
- `Tangerine-Setup-0.1.0-x64.exe`: a per-user installer that needs no admin rights
- `Tangerine-Portable-0.1.0-x64.exe`

To code-sign (recommended, to avoid SmartScreen warnings), set `CSC_LINK` and `CSC_KEY_PASSWORD` before running `npm run dist`.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Electron + Vite dev mode |
| `npm run build` | Compile main, worker, preload and renderer into `out/` |
| `npm run typecheck` | Strict TypeScript for the Node and web projects |
| `npm run fetch:bin` | Download all bundled converters (`--force`, `--only ffmpeg,magick`, `--system-deps`) |
| `npm run fetch:ffmpeg` | PowerShell FFmpeg-only bundler with SHA-256 check (`scripts/bundle-ffmpeg.ps1`) |
| `npm run verify:bin` | Fails the build if a bundled tool is missing |
| `npm run dist*` | Electron Builder packaging |

---

## Project structure

```
tangerine-windows/
├─ electron.vite.config.ts      # 3 builds: main (+ worker entry), preload, renderer
├─ electron-builder.yml         # NSIS + portable, extraResources → resources/bin
├─ build/                       # icon.ico, installer.nsh (uninstall cleanup)
├─ resources/
│  ├─ bin/                      # bundled converters (git-ignored, filled by fetch:bin)
│  └─ icons/                    # tray + app icons
├─ scripts/
│  ├─ fetch-binaries.mjs        # FFmpeg, ImageMagick, qpdf, Pandoc (+ winget system deps)
│  ├─ bundle-ffmpeg.ps1         # FFmpeg-only bundler, checksum-verified
│  └─ verify-binaries.mjs
└─ src/
   ├─ shared/                   # renderer-safe: types, IPC channel names, ACTION CATALOG, file kinds
   ├─ main/                     # ── backend (Node / Electron main) ──
   │  ├─ index.ts               # lifecycle, single instance, wiring
   │  ├─ ipc.ts                 # all ipcMain handlers
   │  ├─ tray.ts
   │  ├─ actions/               # ACTION IMPLEMENTATIONS (CLI builders) per kind + registry
   │  ├─ jobs/                  # JobManager (batches) → JobQueue (Worker pool) → worker.ts
   │  ├─ input/dragWatcher.ts   # global low-level mouse hook → Shift+drag detection
   │  ├─ integration/           # Explorer context menu (HKCU), launch on startup
   │  ├─ services/              # settings store, tool resolver, output naming, logger, updates, theme
   │  └─ windows/               # overlay (radial menu), settings, toast
   ├─ preload/index.ts          # contextBridge → window.tangerine (typed by shared/api.ts)
   └─ renderer/                 # ── frontend (React) ──
      └─ src/
         ├─ overlay/            # Overlay state machine, RadialMenu (SVG + Framer Motion), ProgressCore
         ├─ settings/           # Settings panel (Fluent-style controls)
         ├─ toast/              # error/success toast with "Open Logs"
         └─ lib/                # ring geometry, menu model + hit testing, icons, theme hook
```

The backend and frontend are separated strictly. The renderer has **no Node access** (`sandbox: true`, `contextIsolation: true`). It talks only through the typed `window.tangerine` API.

---

## Architecture

```
 Low-level mouse hook ──Shift+20px──▶ Overlay window (pre-created, hidden)
   (uiohook-napi)                      setBounds + showInactive  (< 100 ms)
                                              │ OLE drag enters → MIME → context-aware rings
                                              ▼ drop on segment → file paths (webUtils)
 Renderer ──ipc jobs:run──▶ JobManager ─ validate kind/tools ─ resolve output path
                                │
                                ▼
                        JobQueue (Worker Thread pool, lazy, reaped when idle)
                                │  worker.ts: stage long paths → ffprobe → build steps
                                ▼
                     spawn ffmpeg / magick / gs / qpdf / pandoc / soffice (windowsHide)
                                │  -progress pipe:1 → %   ·  stderr tail → error message
                                ▼
                    write to temp → atomic move → Desktop/…/name_converted.ext
```

Key design decisions:

- **Drop target instead of reading Explorer's selection.** When the hook detects Shift+drag, the overlay appears under the cursor as a 1 %-alpha window, which keeps it hit-testable. Windows' own drag-and-drop then delivers the exact file paths when the user releases. This works from Explorer, the Desktop and any app that drags files. The overlay only becomes visible when files actually enter it, so a Shift-drag of text in an editor shows nothing.
- **The drop is always accepted as COPY.** Shift+drag asks Explorer for a *move*. Accepting it as a move could make Explorer delete the source, so the overlay forces `dropEffect = 'copy'`.
- **Each conversion runs in a Worker Thread.** Every external tool writes to a temp folder, and the result is moved atomically, so a failed run never leaves a half-written file.
- **Long paths (> 260 characters).** Node handles long paths natively. Inputs with long paths are hard-linked (or copied across volumes) into a short temp path for tools that cannot handle them, and outputs are moved with `fs`.
- **DPI.** The hook reports physical pixels, which are converted with `screen.screenToDipPoint`, so the menu lands exactly under the cursor at 150 % or 200 % scaling on 4K displays.
- **Theme.** `nativeTheme` follows the Windows light/dark setting live, and Settings can override it. The Settings window uses Mica on Windows 11.

### Adding a new action (the path to 100+ actions)

1. Add a descriptor to `src/shared/actions.ts`:
   ```ts
   { id: 'video.to-webm', label: 'WEBM', hint: 'Convert to WebM (VP9)', icon: 'Film',
     kind: 'video', group: 'convert', excludes: ['webm'], tools: ['ffmpeg', 'ffprobe'] }
   ```
2. Add the implementation with the same id in `src/main/actions/video.ts`:
   ```ts
   { id: 'video.to-webm', outputExt: () => 'webm', needsDuration: true,
     build: (ctx) => [{ tool: 'ffmpeg', progress: 'ffmpeg',
       args: ['-y', '-i', ctx.inputs[0]!, '-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-c:a', 'libopus', ctx.output] }] }
   ```

Nothing else is needed. The action then appears in the radial menu, the Favorites picker, batch mode and the keyboard navigation. If a kind has more than 11 conversions, they automatically overflow into a **More** group. `verifyRegistry()` logs any descriptor that has no implementation, and the reverse, at startup. Multi-step pipelines are supported (see `doc.to-pdf`: Markdown → DOCX with Pandoc → PDF with LibreOffice), and so are folder outputs (`outputIsDir`) and many-to-one jobs (`batch: 'merge'`).

---

## Settings (tray icon → Settings)

These settings are available: launch on startup, the Shift-drag on/off switch, theme, output folder (**Desktop**, *Next to original*, *Custom folder* or *Ask each time*, which uses the native Windows Save and Folder dialogs), the file-name suffix, the quality preset, a toggle for each file type, 4 Favorites per type, the Explorer right-click entry, tool locations with live status, an **Open Logs** button and the **100 % Local Processing** badge.

The settings are stored in `%APPDATA%\Tangerine\settings.json`. Logs are in `%APPDATA%\Tangerine\logs\tangerine.log`, rotated at 2 MB.

## Privacy

- No telemetry, analytics or crash upload.
- The **only** network request is the optional update check: one GET to the GitHub Releases API, 15 s after launch. You can turn it off in Settings. Set `tangerine.updateRepo` in `package.json` to your repository; while it is the placeholder, no request is made.
- All conversion happens through local executables. No file leaves the machine.

## Error handling

When a tool exits with an error, the progress ring turns red and a toast appears showing the tool's last error line and an **Open Logs** button. The log records the full command line and the last 4 KB of stderr. If a required tool is missing, you get a clear message ("LibreOffice was not found — install it or set its location in Settings → Tools") rather than a crash.

---

## Performance targets and how they are met

| Target | Approach |
|---|---|
| Cold start < 2 s | No main window. A single small overlay is preloaded, the Settings window is created on demand, and workers are spawned lazily |
| Menu < 100 ms | The overlay window and React tree are already loaded, so showing the menu is one `setBounds` + `showInactive` + IPC message. Spring animation runs at 60 fps |
| 100 MB video compress < 30 s | `libx264 -preset veryfast`, ≤ 1080p, `-threads 0`. Use the *Smallest file* preset on slower CPUs |
| < 200 MB idle | One hidden renderer and no workers when idle (they are terminated after 60 s). Settings is destroyed on close |

Measure startup and idle memory in your own environment with `%APPDATA%\Tangerine\logs\tangerine.log` (it logs "Ready in N ms") and Task Manager → Details, adding up all `Tangerine.exe` processes.

## Known limitations (MVP)

- **Glass blur.** A transparent, non-rectangular Electron window cannot blur the desktop behind it (`backdrop-filter` only blurs page content). The menu uses a translucent tinted glass with gradients and a shadow instead. Acrylic or Mica is applied to the Settings window.
- **Windows 11 modern context menu.** The classic registry verb appears under *Show more options*. Adding a top-level entry needs an MSIX sparse package with an `IExplorerCommand` handler (on the roadmap).
- **Elevated windows.** Windows UIPI stops a non-admin app from hooking drags that start in an app running as administrator.
- **Antivirus.** Global input hooks can trigger heuristic warnings. Code-signing the build helps.
- **Detecting the file type during a drag** relies on the MIME type Windows reports. If none is reported (some `.md` or `.mkv` setups), the menu shows every kind as a group, and the exact type is validated on drop.

## Roadmap (the architecture is ready for these)

- Image: crop, flip, colour space, padding/background, corner radius, gradient background, EXIF editor, annotate
- Video: trim, resolution/FPS, H.265, merge, more containers
- Audio: trim, bitrate, merge, OGG/OPUS
- PDF: → DOCX/TXT/JPG, split, add/remove password (qpdf)
- Documents: → TXT, → DOCX from MD/RTF
- An interactive editor sheet for parameterised actions (for example, a trim range or crop box)

## Licensing

The app's source code is MIT-licensed. The bundled tools keep their own licenses, and you must comply with them when you redistribute:

| Tool | License | Notes |
|---|---|---|
| FFmpeg (gyan.dev essentials build) | **GPLv3** | Distributing it requires offering the corresponding source. For a non-GPL distribution, use an LGPL build without libx264 |
| ImageMagick | ImageMagick License (Apache-2.0-style) | |
| qpdf | Apache-2.0 | |
| Pandoc | GPLv2+ | |
| Ghostscript | **AGPL** | Not bundled; detected from the user's own install |
| LibreOffice | MPL-2.0 | Not bundled; detected from the user's own install |

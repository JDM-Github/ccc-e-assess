# jdm-electron-flask-electron

Electron shell template for [jdm-electron-flask-template](https://github.com/JDM-Github/jdm-electron-flask-electron) desktop apps.

## Stack

- Electron
- electron-builder (NSIS installer)

## Structure

```
electron/
├── main.js          # Main process — backend lifecycle, IPC
├── loading.html     # Splash screen while backend starts
├── resources/
│   └── backend/
│       └── flask_server/   # Built Flask exe (release)
├── test/                   # Unpacked build for testing
└── package.json
```

## Setup

```bash
npm install
```

## Running (dev)

Start from the project root:
```bash
run dev
```

## Building

```bash
run compile --electron
```

Packages the app using `electron-builder` with whatever is in `resources/`. Output goes to `outputs/{version}/`.

## Testing Without Full Rebuild

After `jdm compile --backend` or `jdm compile --frontend`, the `test/` folder is updated automatically. Launch the unpacked exe directly from `test/` to test changes without rebuilding the installer.

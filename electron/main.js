const { app, BrowserWindow, dialog, Menu } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const net = require('net');

let backendProcess = null;
let mainWindow = null;
let isQuitting = false;

function getBackendExe() {
    const exeName = process.platform === "win32"
        ? `flask_server.exe`
        : 'flask_server';

    if (app.isPackaged) {
        return path.join(process.resourcesPath, "backend", "flask_server", exeName);
    }
    return path.join(__dirname, "../backend/dist", "flask_server", exeName);
}

function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', reject);
    });
}

function waitForPort(port, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const tryConnect = () => {
            const socket = new net.Socket();
            socket.setTimeout(300);
            socket
                .once('connect', () => { socket.destroy(); resolve(); })
                .once('error', () => {
                    socket.destroy();
                    if (Date.now() - start > timeout) {
                        reject(new Error(`Backend did not respond within ${timeout}ms`));
                    } else {
                        setTimeout(tryConnect, 250);
                    }
                })
                .once('timeout', () => { socket.destroy(); setTimeout(tryConnect, 250); })
                .connect(port, '127.0.0.1');
        };
        tryConnect();
    });
}

function killBackend() {
    if (!backendProcess) return;

    console.log('[Electron] Stopping backend...');
    const proc = backendProcess;
    const pid = proc.pid;
    backendProcess = null;

    if (process.platform === 'win32') {
        try {
            execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
            console.log('[Electron] Backend process tree killed via taskkill.');
        } catch (e) {
            console.error('[Electron] taskkill failed:', e.message);
        }
    } else {
        try {
            process.kill(-pid, 'SIGKILL');
        } catch {
            proc.kill('SIGKILL');
        }
    }
}

function startBackend(port) {
    const exePath = getBackendExe();
    console.log('[Backend] launching:', exePath);
    console.log(`[Backend] port: ${port}`);

    backendProcess = spawn(exePath, [], {
        stdio: 'pipe',
        windowsHide: true,
        detached: process.platform !== 'win32',
        env: { ...process.env, FLASK_PORT: String(port) },
    });

    backendProcess.stdout.on('data', (d) => console.log('[Backend]', d.toString().trim()));
    backendProcess.stderr.on('data', (d) => console.error('[Backend ERR]', d.toString().trim()));
    backendProcess.on('exit', (code) => {
        console.log('[Backend] exited with code', code);
        if (!isQuitting) {
            isQuitting = true;
            dialog.showErrorBox('Backend crashed', `Flask server exited unexpectedly (code ${code}).`);
            app.quit();
        }
    });
}

async function createWindow() {
    Menu.setApplicationMenu(null);
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 1000,
        minHeight: 650,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    mainWindow.loadFile(path.join(__dirname, 'loading.html'));
    mainWindow.show();

    const port = await getFreePort();

    startBackend(port);
    try {
        await waitForPort(port);
        mainWindow.loadURL(`http://127.0.0.1:${port}`);
    } catch (err) {
        dialog.showErrorBox('Backend failed to start', err.message);
        isQuitting = true;
        app.quit();
    }
}

app.on('before-quit', () => {
    isQuitting = true;
    killBackend();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});


// STARTING
app.whenReady().then(createWindow);

process.on('uncaughtException', (err) => {
    console.error('[Electron] Uncaught Exception:', err);
    killBackend();
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('[Electron] Unhandled Rejection:', reason);
    killBackend();
    process.exit(1);
});
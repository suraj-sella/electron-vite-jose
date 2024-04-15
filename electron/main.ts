import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import crypto from 'node:crypto'

// eslint-disable-next-line @typescript-eslint/no-var-requires
// const jose = require('jose'); // this is te only way we get the node dist of jose
import * as jose from 'jose' // this is the recommended typescript way of import but it takes browser code so not working  
console.log(jose.cryptoRuntime);

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')


let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {

  // locksmith encryption part
  const { publicKey, privateKey } = await jose.generateKeyPair('ES512');
  console.log(publicKey)
  console.log(privateKey)

  let publicPem = await jose.exportSPKI(publicKey);
  publicPem = publicPem.replace('-----BEGIN PUBLIC KEY-----', '').replace('-----END PUBLIC KEY-----', '').replace(/\r?\n|\r/g, '');
  console.log(publicPem); //sent to ppm

  // ppm code 
  const decodedPublicKey = Buffer.from(publicPem, 'base64');
  const importedKey = crypto.createPublicKey({
    format: 'der',
    key: decodedPublicKey,
    type: 'spki'
  });
  const data = {
    message: 'hey this is message',
    success: true
  };
  const jwe = await new jose.CompactEncrypt(Buffer.from(JSON.stringify(data)))
    .setProtectedHeader({ alg: 'ECDH-ES', enc: 'A256GCM' })
    .encrypt(importedKey);

  const encryptedData = Buffer.from(jwe).toString('base64');
  console.log(encryptedData);

  // locksmith decryption
  const decryptedData = await jose.compactDecrypt(Buffer.from(encryptedData, 'base64'), privateKey)
  console.log(decryptedData);

  const decryptedDataJson = JSON.parse(decryptedData.plaintext.toString());
  console.log(decryptedDataJson);
})

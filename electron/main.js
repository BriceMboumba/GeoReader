// electron/main.js
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import fs from 'fs'

// __dirname n'existe pas en ESM → on le recrée
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('=== MAIN PROCESS START ===')
console.log('__dirname:', __dirname)

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js')
  console.log('Chemin preload:', preloadPath)
  console.log('Preload existe:', fs.existsSync(preloadPath))

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      sandbox: false // Important pour que le preload fonctionne
    }
  })

  // Stocker la référence de la fenêtre pour les dialogs
  global.mainWindow = win

  // Debug: écouter les erreurs de preload
  win.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('Erreur preload:', { preloadPath, error })
  })

  // Debug: écouter quand le preload est chargé
  win.webContents.on('did-finish-load', () => {
    console.log('Page chargée - injection de test')
    // Test direct pour vérifier si electronAPI est disponible
    win.webContents.executeJavaScript(`
      console.log('=== TEST FROM MAIN ===');
      console.log('window.electronAPI disponible:', !!window.electronAPI);
      if (window.electronAPI) {
        console.log('electronAPI.test():', window.electronAPI.test());
      }
      console.log('=== END TEST ===');
    `).catch(err => {
      console.error('Erreur executeJavaScript:', err)
    })
  })

  // SUPPRIMÉ: Ouvrir les DevTools pour voir les logs
  // win.webContents.openDevTools()

  if (process.env.VITE_DEV_SERVER_URL) {
    console.log('Chargement dev server:', process.env.VITE_DEV_SERVER_URL)
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html')
    console.log('Chargement fichier:', indexPath)
    win.loadFile(indexPath)
  }
}

app.whenReady().then(() => {
  console.log('App ready')
  createWindow()
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Dialog pour sélectionner des fichiers
ipcMain.handle('show-open-dialog', async (event, options) => {
  console.log('=== SHOW OPEN DIALOG ===')
  console.log('options:', options)
  
  try {
    const result = await dialog.showOpenDialog(global.mainWindow, options)
    console.log('Dialog result:', result)
    return result
  } catch (error) {
    console.error('Erreur dialog:', error)
    return { canceled: true, error: error.message }
  }
})

// Conversion ogr2ogr
ipcMain.handle('exec-ogr2ogr', async (event, tabFilePath, outputDir) => {
  console.log('=== EXEC OGR2OGR ===')
  console.log('tabFilePath:', tabFilePath)
  console.log('outputDir:', outputDir)
  
  return new Promise((resolve) => {
    // Créer le dossier de sortie s'il n'existe pas
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
      console.log('Dossier créé:', outputDir)
    }

    const command = `ogr2ogr -f "ESRI Shapefile" -t_srs EPSG:4326 "${outputDir}" "${tabFilePath}"`
    
    console.log('Commande:', command)
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Erreur ogr2ogr:', error)
        console.error('stderr:', stderr)
        resolve({ success: false, error: stderr || error.message })
      } else {
        console.log('ogr2ogr succès:', stdout)
        resolve({ success: true, stdout })
      }
    })
  })
})

// Lecture de fichiers binaires
ipcMain.handle('read-file', async (event, filePath) => {
  console.log('=== READ FILE ===')
  console.log('filePath:', filePath)
  
  try {
    const data = fs.readFileSync(filePath)
    console.log('Fichier lu avec succès, taille:', data.length)
    return data.buffer
  } catch (err) {
    console.error('Erreur lecture fichier:', err)
    return { error: err.message }
  }
})

// Vérification Electron
ipcMain.handle('is-electron', async () => {
  console.log('is-electron appelé')
  return true
})

console.log('=== MAIN PROCESS SETUP COMPLETE ===')

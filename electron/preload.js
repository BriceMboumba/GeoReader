// electron/preload.js
import { contextBridge, ipcRenderer } from 'electron'
import path from 'path'
import fs from 'fs'

console.log('=== PRELOAD SCRIPT START ===')

// Créer l'objet API
const electronAPI = {
  // Utilitaires de chemin
  joinPath: (...args) => path.join(...args),
  dirname: (filePath) => path.dirname(filePath),

  // NOUVELLES FONCTIONS AJOUTÉES
  getStats: (filePath) => {
    return new Promise((resolve, reject) => {
      fs.stat(filePath, (err, stats) => {
        if (err) {
          reject(err)
        } else {
          resolve(stats)
        }
      })
    })
  },

  pathExists: (filePath) => {
    return new Promise((resolve) => {
      fs.access(filePath, fs.constants.F_OK, (err) => {
        resolve(!err)
      })
    })
  },

  // Sélecteur de fichiers
  showOpenDialog: (options) => {
    console.log('showOpenDialog appelé avec:', options)
    return ipcRenderer.invoke('show-open-dialog', options)
  },

  // Conversion ogr2ogr
  execOgr2ogr: (tabFilePath, outputDir) => {
    console.log('execOgr2ogr appelé avec:', { tabFilePath, outputDir })
    return ipcRenderer.invoke('exec-ogr2ogr', tabFilePath, outputDir)
  },

  // Lecture de fichiers shapefile avec tous les composants nécessaires
  readShapefile: async (shpFilePath) => {
    console.log('readShapefile appelé avec:', shpFilePath)
    try {
      const basePath = shpFilePath.replace(/\.shp$/i, '')
      const files = {}

      const extensions = ['shp', 'dbf', 'shx', 'prj', 'cpg']

      for (const ext of extensions) {
        const filePath = `${basePath}.${ext}`
        try {
          if (fs.existsSync(filePath)) {
            files[ext] = fs.readFileSync(filePath)
            console.log(`Fichier ${ext} lu:`, files[ext].length, 'bytes')
          }
        } catch (err) {
          console.log(`Fichier ${ext} non trouvé ou erreur:`, err.message)
        }
      }

      if (!files.shp) {
        throw new Error('Fichier .shp principal non trouvé')
      }

      return { success: true, files }
    } catch (err) {
      console.error('Erreur lecture shapefile:', err)
      return { error: err.message }
    }
  },

  // Lecture de fichiers simple (pour compatibilité)
  readFile: (filePath) => {
    console.log('readFile appelé avec:', filePath)
    return ipcRenderer.invoke('read-file', filePath)
  },

  // Vérification Electron
  isElectron: () => {
    console.log('isElectron appelé')
    return ipcRenderer.invoke('is-electron')
  },

  // Test simple
  test: () => 'electronAPI fonctionne!'
}

console.log('electronAPI créé:', electronAPI)

try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
  console.log('contextBridge.exposeInMainWorld réussi')
} catch (error) {
  console.error('Erreur contextBridge.exposeInMainWorld:', error)
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded - window.electronAPI:', !!window.electronAPI)
})

console.log('=== PRELOAD SCRIPT END ===')
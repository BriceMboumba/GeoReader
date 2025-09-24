<template>
  <div class="converter-container">
    <!-- Carte principale qui occupe tout l'écran -->
    <div id="map" ref="mapContainer"></div>

    <!-- Panneau latéral pour les contrôles -->
    <div class="control-panel">
      <div class="panel-header">
        <h3>Convertisseur TAB → SHP</h3>
      </div>

      <div class="panel-content">
        <!-- Section sélection de langue -->
        <div class="section">
          <h4>Langue de la carte</h4>
          <select v-model="selectedLanguage" @change="changeMapLanguage" class="language-select">
            <option value="fr">Français</option>
            <option value="ar">Arabe</option>
          </select>
        </div>

        <!-- Section conversion TAB -->
        <div class="section">
          <h4>Convertir un fichier .TAB</h4>
          <div class="file-section">
            <button
              @click="selectTabFile"
              class="file-select-btn"
            >
              Sélectionner un fichier .TAB
            </button>
            <div v-if="selectedTabFile" class="file-info">
              Fichier sélectionné : {{ selectedTabFile.name }}
            </div>
          </div>

          <button
            @click="convertFile"
            :disabled="!selectedTabFile || isConverting"
            class="convert-btn"
          >
            {{ isConverting ? 'Conversion en cours...' : 'Convertir en Shapefile' }}
          </button>

          <!-- Message de succès et bouton afficher DIRECTEMENT sous le bouton convertir -->
          <div v-if="conversionResult && conversionResult.success" class="result-section">
            <div class="result-message success">
              {{ conversionResult.message }}
            </div>
            <button
              @click="loadConvertedShpFile"
              :disabled="isLoadingConvertedShp"
              class="load-btn"
            >
              <div class="button-content">
                <div v-if="isLoadingConvertedShp" class="loading-spinner"></div>
                <span>{{ isLoadingConvertedShp ? 'Chargement...' : 'Afficher sur la carte' }}</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Section ouvrir SHP existant -->
        <div class="section">
          <h4>Ouvrir un fichier .SHP existant</h4>
          <div class="file-section">
            <button
              @click="selectShpFile"
              class="file-select-btn"
            >
              Sélectionner un fichier .SHP
            </button>
            <div v-if="selectedShpFile" class="file-info">
              Fichier sélectionné : {{ selectedShpFile.name }}
            </div>
          </div>

          <button
            @click="loadSelectedShpFile"
            :disabled="!selectedShpFile || isLoadingSelectedShp"
            class="load-btn"
          >
            <div class="button-content">
              <div v-if="isLoadingSelectedShp" class="loading-spinner"></div>
              <span>{{ isLoadingSelectedShp ? 'Chargement...' : 'Ouvrir le Shapefile' }}</span>
            </div>
          </button>
        </div>

        <!-- Section rafraîchir -->
        <div class="section">
          <button @click="refreshApp" class="refresh-btn">
            🔄 Rafraîchir l'application
          </button>
        </div>

        <!-- Messages d'erreur généraux -->
        <div v-if="conversionResult && !conversionResult.success" class="result-section">
          <div class="result-message error">
            {{ conversionResult.message }}
          </div>
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>
    </div>

    <!-- Tooltip pour les informations des features -->
    <div id="tooltip" class="tooltip" ref="tooltip"></div>

    <!-- Overlay de chargement -->
    <div v-if="isLoadingConvertedShp || isLoadingSelectedShp" class="loading-overlay">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: loadingProgress + '%' }"></div>
      </div>
      <div class="progress-text">{{ loadingMessage }}</div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Références
const mapContainer = ref(null)
const tooltip = ref(null)
let map = null
let geojsonLayer = null
let currentLayer = null
let currentTileLayer = null

// États
const selectedTabFile = ref(null)
const selectedTabFilePath = ref(null)
const selectedShpFile = ref(null)
const selectedShpFilePath = ref(null)
const isConverting = ref(false)
// États de progression
const loadingProgress = ref(0)
const loadingMessage = ref('Chargement des données...')
// États de chargement séparés pour chaque bouton
const isLoadingConvertedShp = ref(false)
const isLoadingSelectedShp = ref(false)
const conversionResult = ref(null)
const convertedShpPath = ref(null)
const error = ref(null)
const selectedLanguage = ref('fr') // Français par défaut

// URLs des tuiles selon la langue
const tileUrls = {
  fr: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
  ar: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  en: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
}

// Attributions selon la langue
const attributions = {
  fr: '© OpenStreetMap France contributors',
  ar: '© مساهمو OpenStreetMap',
  en: '© OpenStreetMap contributors'
}

// Initialisation de la carte
onMounted(() => {
  nextTick(() => {
    checkElectronAPI()
    initializeMap()
  })
})

onUnmounted(() => {
  if (map) {
    map.remove()
  }
})

function initializeMap() {
  if (!mapContainer.value) return

  // S'assurer que le conteneur a la bonne taille
  mapContainer.value.style.width = '100vw'
  mapContainer.value.style.height = '100vh'
  mapContainer.value.style.position = 'absolute'
  mapContainer.value.style.top = '0'
  mapContainer.value.style.left = '0'

  map = L.map(mapContainer.value).setView([31.7, -6], 6)

  // Ajouter la couche de tuiles en français par défaut
  addTileLayer('fr')

  // Redimensionner la carte après l'initialisation
  setTimeout(() => {
    map.invalidateSize()
  }, 100)

  // Initialiser le tooltip
  if (tooltip.value) {
    tooltip.value.style.display = 'none'
  }
}

function addTileLayer(language) {
  // Supprimer la couche précédente si elle existe
  if (currentTileLayer) {
    map.removeLayer(currentTileLayer)
  }

  // Ajouter la nouvelle couche
  currentTileLayer = L.tileLayer(tileUrls[language], {
    maxZoom: 19,
    attribution: attributions[language]
  }).addTo(map)
}

function changeMapLanguage() {
  if (map) {
    addTileLayer(selectedLanguage.value)
  }
}

async function selectTabFile() {
  if (!window.electronAPI) {
    error.value = 'electronAPI non disponible'
    return
  }

  try {
    const result = await window.electronAPI.showOpenDialog({
      title: 'Sélectionner un fichier .TAB',
      filters: [
        { name: 'Fichiers TAB', extensions: ['tab', 'TAB'] },
        { name: 'Tous les fichiers', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    console.log('Dialog result:', result)

    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      selectedTabFilePath.value = filePath

      // Extraire seulement le nom du fichier (pas le répertoire)
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop()

      selectedTabFile.value = {
        name: fileName,
        path: filePath
      }
      error.value = null
      conversionResult.value = null
      console.log('Fichier TAB sélectionné:', filePath)
    }
  } catch (err) {
    console.error('Erreur sélection fichier TAB:', err)
    error.value = `Erreur lors de la sélection: ${err.message}`
  }
}

async function selectShpFile() {
  if (!window.electronAPI) {
    error.value = 'electronAPI non disponible'
    return
  }

  try {
    const result = await window.electronAPI.showOpenDialog({
      title: 'Sélectionner un fichier .SHP',
      filters: [
        { name: 'Fichiers Shapefile', extensions: ['shp', 'SHP'] },
        { name: 'Tous les fichiers', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      selectedShpFilePath.value = filePath
      selectedShpFile.value = {
        name: filePath.split('/').pop() || filePath.split('\\').pop(),
        path: filePath
      }
      error.value = null

      // Masquer le message de conversion réussie si présent
      if (conversionResult.value && conversionResult.value.success) {
        conversionResult.value = null
        convertedShpPath.value = null
      }

      console.log('Fichier SHP sélectionné:', filePath)
    }
  } catch (err) {
    console.error('Erreur sélection fichier SHP:', err)
    error.value = `Erreur lors de la sélection: ${err.message}`
  }
}

// Fonction de conversion modifiée avec nom de dossier personnalisé
// Dans Reader.vue - remplacez la fonction convertFile()
async function convertFile() {
  if (!selectedTabFilePath.value) {
    error.value = 'Aucun fichier .TAB sélectionné'
    return
  }

  isConverting.value = true
  error.value = null
  conversionResult.value = null

  try {
    if (!window.electronAPI) {
      throw new Error('La conversion nécessite Electron pour exécuter ogr2ogr')
    }

    const tabFilePath = selectedTabFilePath.value
    console.log('Conversion avec chemin:', tabFilePath)

    const directoryPath = window.electronAPI.dirname(tabFilePath)

    // Récupérer le nom du fichier sans extension
    const fileName = selectedTabFile.value.name.replace(/\.tab$/i, '')

    // Créer le nom du dossier avec le format: NOMFICHIER_shp
    const outputDir = window.electronAPI.joinPath(directoryPath, `${fileName}_shp`)

    const shapefilePath = window.electronAPI.joinPath(outputDir, `${fileName}.shp`)

    console.log('Paramètres conversion:', {
      tabFilePath,
      directoryPath,
      outputDir,
      fileName,
      shapefilePath
    })

    const result = await window.electronAPI.execOgr2ogr(tabFilePath, outputDir)

    if (result.success) {
      conversionResult.value = {
        success: true,
        message: `Conversion réussie ! Le fichier Shapefile a été généré dans le dossier "${fileName}_shp".`,
        shapefilePath: shapefilePath
      }
      convertedShpPath.value = shapefilePath
    } else {
      throw new Error(result.error || 'Erreur inconnue lors de la conversion')
    }

  } catch (err) {
    console.error('Erreur dans convertFile:', err)
    error.value = err.message
    conversionResult.value = {
      success: false,
      message: `Échec de la conversion: ${err.message}`
    }
  } finally {
    isConverting.value = false
  }
}

// Fonction pour charger le fichier SHP sélectionné
async function loadSelectedShpFile() {
  if (!selectedShpFilePath.value) {
    error.value = 'Aucun fichier .SHP sélectionné'
    return
  }

  isLoadingSelectedShp.value = true
  error.value = null

  try {
    if (window.electronAPI && window.electronAPI.readShapefile) {
      // Utiliser la nouvelle méthode pour lire tous les composants du shapefile
      const result = await window.electronAPI.readShapefile(selectedShpFilePath.value)
      if (result.error) {
        throw new Error(result.error)
      }
      await loadShapefileFromFiles(result.files, selectedShpFile.value.name)
    } else {
      throw new Error('Méthode readShapefile non disponible')
    }
  } catch (err) {
    error.value = `Erreur lors du chargement du Shapefile: ${err.message}`
  } finally {
    isLoadingSelectedShp.value = false
  }
}

async function loadConvertedShpFile() {
  if (!convertedShpPath.value) return

  isLoadingConvertedShp.value = true
  error.value = null

  try {
    // Dans Electron, on peut charger le fichier directement par son chemin
    if (window.electronAPI && window.electronAPI.readShapefile) {
      const result = await window.electronAPI.readShapefile(convertedShpPath.value)
      if (result.error) {
        throw new Error(result.error)
      }
      const fileName = convertedShpPath.value.split('/').pop() || convertedShpPath.value.split('\\').pop()
      await loadShapefileFromFiles(result.files, fileName)
    } else {
      throw new Error('Méthode readShapefile non disponible')
    }
  } catch (err) {
    error.value = `Erreur lors du chargement du Shapefile converti: ${err.message}`
  } finally {
    isLoadingConvertedShp.value = false
  }
}

async function loadShapefileFromFiles(files, fileName) {
  try {
    // Nettoyer la couche précédente si elle existe
    if (geojsonLayer) {
      map.removeLayer(geojsonLayer)
      geojsonLayer = null
    }

    // Charger shapefile-js si nécessaire
    if (!window.shapefile) {
      await loadShapefileLibrary()
    }

    // Convertir les buffers Node.js en ArrayBuffers
    const shpBuffer = files.shp.buffer.slice(files.shp.byteOffset, files.shp.byteOffset + files.shp.byteLength)
    const dbfBuffer = files.dbf ? files.dbf.buffer.slice(files.dbf.byteOffset, files.dbf.byteOffset + files.dbf.byteLength) : null

    console.log('Début du chargement du shapefile...')

    // Mettre à jour la progression
    loadingProgress.value = 0
    loadingMessage.value = 'Démarrage du traitement...'

    // Traitement asynchrone par lots pour éviter de bloquer l'UI
    const features = await processShapefileInBatches(shpBuffer, dbfBuffer)

    // Créer les couches optimisées
    await createLayersFromFeatures(features)

    loadingProgress.value = 100
    loadingMessage.value = 'Chargement terminé!'

    console.log(`Shapefile chargé: ${features.length} features`)

  } catch (err) {
    console.error('Erreur détaillée:', err)
    loadingMessage.value = 'Erreur lors du chargement'
    throw new Error(`Impossible de charger le Shapefile: ${err.message}`)
  }
}

// Traitement par lots pour éviter de bloquer l'interface
async function processShapefileInBatches(shpBuffer, dbfBuffer, batchSize = 5000) {
  return new Promise(async (resolve, reject) => {
    try {
      const source = await window.shapefile.open(shpBuffer, dbfBuffer)
      const allFeatures = []
      let totalFeatures = 0
      let bounds = null

      const processBatch = async () => {
        const batchFeatures = []
        let count = 0

        // Lire un lot de features
        let result = await source.read()
        while (!result.done && count < batchSize) {
          if (result.value) {
            batchFeatures.push(result.value)
            count++
            totalFeatures++

            // Calculer les bounds progressivement
            if (result.value.geometry) {
              const featureBounds = calculateFeatureBounds(result.value.geometry)
              if (bounds) {
                bounds = extendBounds(bounds, featureBounds)
              } else {
                bounds = featureBounds
              }
            }

            // Mettre à jour la progression toutes les 1000 features
            if (totalFeatures % 1000 === 0) {
              loadingProgress.value = Math.min(80, Math.round((totalFeatures / 2000000) * 100))
              loadingMessage.value = `Traitement de ${totalFeatures.toLocaleString()} features...`
            }

            // Limiter à 200,000 features maximum pour les performances
            if (totalFeatures >= 200000) {
              loadingMessage.value = `Affichage des premières 200,000 features sur ${totalFeatures}...`
              break
            }
          }
          result = await source.read()
        }

        // Ajouter les features du lot
        allFeatures.push(...batchFeatures)

        // Mettre à jour les bounds de la carte périodiquement
        if (bounds && totalFeatures % 50000 === 0) {
          updateMapBounds(bounds)
        }

        if (!result.done && totalFeatures < 200000) {
          // Pause courte pour libérer l'UI, puis continuer
          setTimeout(processBatch, 10)
        } else {
          // Dernière mise à jour des bounds
          if (bounds) {
            updateMapBounds(bounds)
          }

          // Simplifier les propriétés pour réduire la mémoire
          const simplifiedFeatures = allFeatures.map(feature => ({
            type: 'Feature',
            geometry: feature.geometry,
            properties: simplifyProperties(feature.properties)
          }))

          resolve(simplifiedFeatures)
        }
      }

      // Démarrer le traitement
      await processBatch()

    } catch (err) {
      reject(err)
    }
  })
}

// Fonctions utilitaires pour le calcul des bounds
function calculateFeatureBounds(geometry) {
  const coords = getCoordinates(geometry)
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity

  coords.forEach(coord => {
    const [lng, lat] = coord
    minLat = Math.min(minLat, lat)
    minLng = Math.min(minLng, lng)
    maxLat = Math.max(maxLat, lat)
    maxLng = Math.max(maxLng, lng)
  })

  return {
    _southWest: { lat: minLat, lng: minLng },
    _northEast: { lat: maxLat, lng: maxLng }
  }
}

function extendBounds(bounds1, bounds2) {
  return {
    _southWest: {
      lat: Math.min(bounds1._southWest.lat, bounds2._southWest.lat),
      lng: Math.min(bounds1._southWest.lng, bounds2._southWest.lng)
    },
    _northEast: {
      lat: Math.max(bounds1._northEast.lat, bounds2._northEast.lat),
      lng: Math.max(bounds1._northEast.lng, bounds2._northEast.lng)
    }
  }
}

function getCoordinates(geometry) {
  if (geometry.type === 'Point') {
    return [geometry.coordinates]
  } else if (geometry.type === 'LineString') {
    return geometry.coordinates
  } else if (geometry.type === 'Polygon') {
    return geometry.coordinates.flat()
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flat(2)
  }
  return []
}

function simplifyProperties(properties) {
  const simplified = {}
  for (let key in properties) {
    if (properties[key] !== null && properties[key] !== undefined) {
      let value = properties[key]
      if (typeof value === 'string' && value.length > 50) {
        value = value.substring(0, 50) + '...'
      }
      simplified[key] = value
    }
  }
  return simplified
}

function updateMapBounds(bounds) {
  if (map && bounds) {
    const leafletBounds = L.latLngBounds(
      L.latLng(bounds._southWest.lat, bounds._southWest.lng),
      L.latLng(bounds._northEast.lat, bounds._northEast.lng)
    )
    map.fitBounds(leafletBounds, { padding: [20, 20] })
  }
}

// Fonction pour créer les couches à partir des features traitées
async function createLayersFromFeatures(features) {
  loadingMessage.value = 'Création des couches cartographiques...'
  loadingProgress.value = 85

  // Séparer les points des polygones/lignes
  const pointFeatures = features.filter(f => f.geometry && f.geometry.type === 'Point')
  const otherFeatures = features.filter(f => f.geometry && f.geometry.type !== 'Point')

  console.log(`Création des couches: ${pointFeatures.length} points, ${otherFeatures.length} autres features`)

  // Créer un groupe de layers
  const layerGroup = L.layerGroup()

  // Créer la couche clusterisée pour les points (si nécessaire)
  if (pointFeatures.length > 0) {
    loadingMessage.value = 'Création des clusters de points...'
    const clusterLayer = await createOptimizedClusterLayer(pointFeatures)
    layerGroup.addLayer(clusterLayer)
  }

  // Créer la couche GeoJSON pour les autres geometries
  if (otherFeatures.length > 0) {
    loadingMessage.value = 'Création des polygones et lignes...'
    const geoJSONLayer = createOptimizedGeoJSONLayer(otherFeatures)
    layerGroup.addLayer(geoJSONLayer)
  }

  // Ajouter le groupe à la carte
  layerGroup.addTo(map)
  geojsonLayer = layerGroup

  loadingProgress.value = 95
  loadingMessage.value = 'Finalisation...'

  console.log('Couches créées avec succès')
}

// Fonction pour créer un worker web dédié au traitement des shapefiles
function createShapefileWorker() {
  return new Promise((resolve, reject) => {
    const workerCode = `
      // Ne PAS utiliser importScripts pour les CDN externes
      // Utiliser les fonctions natives pour le traitement des shapefiles

      let shapefileLib = null;

      // Charger shapefile-js depuis le scope global s'il est disponible
      if (self.shapefile) {
        shapefileLib = self.shapefile;
      }

      onmessage = async function(event) {
        const { shpBuffer, dbfBuffer, fileName } = event.data;

        try {
          if (!shapefileLib) {
            // Si shapefile-js n'est pas disponible, utiliser une méthode alternative
            throw new Error('shapefile-js non disponible dans le worker');
          }

          // Lire le shapefile
          const source = await shapefileLib.open(shpBuffer, dbfBuffer);
          const features = [];
          let totalFeatures = 0;
          let bounds = null;

          // Première passe: compter les features et calculer les bounds
          let result = await source.read();
          while (!result.done) {
            if (result.value) {
              totalFeatures++;
              features.push(result.value);

              // Calculer les bounds progressivement
              if (result.value.geometry) {
                const featureBounds = calculateFeatureBounds(result.value.geometry);
                if (bounds) {
                  bounds = extendBounds(bounds, featureBounds);
                } else {
                  bounds = featureBounds;
                }
              }

              // Envoyer une mise à jour de progression toutes les 10000 features
              if (totalFeatures % 10000 === 0) {
                postMessage({
                  type: 'progress',
                  data: {
                    percentage: Math.round((totalFeatures / 1000000) * 100),
                    processed: totalFeatures
                  }
                });
              }

              // Limiter le nombre de features pour les très gros fichiers
              if (totalFeatures >= 500000) {
                postMessage({
                  type: 'progress',
                  data: {
                    percentage: 100,
                    processed: totalFeatures,
                    warning: 'Seulement les premières 500,000 features seront affichées'
                  }
                });
                break;
              }
            }
            result = await source.read();
          }

          // Envoyer les bounds
          if (bounds) {
            postMessage({
              type: 'bounds',
              data: bounds
            });
          }

          // Préparer les données pour l'affichage
          const simplifiedFeatures = features.map(feature => ({
            type: 'Feature',
            geometry: feature.geometry,
            properties: simplifyProperties(feature.properties)
          }));

          // Après avoir collecté les features, les envoyer pour création des couches
          postMessage({
            type: 'features_ready',
            data: {
              features: simplifiedFeatures
            }
          });

          postMessage({
            type: 'complete',
            data: {
              totalFeatures: totalFeatures,
              displayedFeatures: simplifiedFeatures.length,
              bounds: bounds
            }
          });

        } catch (error) {
          postMessage({
            type: 'error',
            data: error.message
          });
        }
      };

      function calculateFeatureBounds(geometry) {
        const coords = getCoordinates(geometry);
        let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;

        coords.forEach(coord => {
          const [lng, lat] = coord;
          minLat = Math.min(minLat, lat);
          minLng = Math.min(minLng, lng);
          maxLat = Math.max(maxLat, lat);
          maxLng = Math.max(maxLng, lng);
        });

        return {
          _southWest: { lat: minLat, lng: minLng },
          _northEast: { lat: maxLat, lng: maxLng }
        };
      }

      function extendBounds(bounds1, bounds2) {
        return {
          _southWest: {
            lat: Math.min(bounds1._southWest.lat, bounds2._southWest.lat),
            lng: Math.min(bounds1._southWest.lng, bounds2._southWest.lng)
          },
          _northEast: {
            lat: Math.max(bounds1._northEast.lat, bounds2._northEast.lat),
            lng: Math.max(bounds1._northEast.lng, bounds2._northEast.lng)
          }
        };
      }

      function getCoordinates(geometry) {
        if (geometry.type === 'Point') {
          return [geometry.coordinates];
        } else if (geometry.type === 'LineString') {
          return geometry.coordinates;
        } else if (geometry.type === 'Polygon') {
          return geometry.coordinates.flat();
        } else if (geometry.type === 'MultiPolygon') {
          return geometry.coordinates.flat(2);
        }
        return [];
      }

      function simplifyProperties(properties) {
        const simplified = {};
        for (let key in properties) {
          if (properties[key] !== null && properties[key] !== undefined) {
            let value = properties[key];
            if (typeof value === 'string' && value.length > 100) {
              value = value.substring(0, 100) + '...';
            }
            simplified[key] = value;
          }
        }
        return simplified;
      }
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    // Vérifier que le worker est prêt
    setTimeout(() => resolve(worker), 100);
  });
}

// Fonction pour charger la bibliothèque shapefile
function loadShapefileLibrary() {
  return new Promise((resolve, reject) => {
    if (window.shapefile) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/shapefile@0.6.6/dist/shapefile.js'
    script.onload = () => {
      if (window.shapefile) {
        console.log('shapefile-js chargé avec succès')
        resolve()
      } else {
        reject(new Error('shapefile-js non chargé correctement'))
      }
    }
    script.onerror = () => reject(new Error('Échec du chargement de shapefile-js'))
    document.head.appendChild(script)
  })
}

// Fonction pour créer une couche clusterisée optimisée (EXISTANTE MAINTENANT UTILISÉE)
function createOptimizedClusterLayer(features) {
  // Charger Leaflet.markercluster si nécessaire
  if (!L.markerClusterGroup) {
    // Charger dynamiquement la bibliothèque de clustering
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'
    document.head.appendChild(script)

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css'
    document.head.appendChild(link)
  }

  const markers = L.markerClusterGroup({
    chunkedLoading: true,
    chunkInterval: 100,
    chunkDelay: 50,
    maxClusterRadius: 40,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: true,
    zoomToBoundsOnClick: true,
    disableClusteringAtZoom: 16
  })

  // Limiter le nombre de points pour les très gros datasets
  const maxPoints = 100000
  const pointsToAdd = features.slice(0, maxPoints)

  if (features.length > maxPoints) {
    console.warn(`Seulement les premiers ${maxPoints} points sur ${features.length} seront affichés`)
  }

  pointsToAdd.forEach(feature => {
    if (feature.geometry && feature.geometry.type === 'Point') {
      const marker = L.marker([
        feature.geometry.coordinates[1],
        feature.geometry.coordinates[0]
      ])

      // Tooltip simplifié
      if (feature.properties) {
        const tooltipContent = createTooltipContent(feature.properties)
        marker.bindTooltip(tooltipContent, {
          permanent: false,
          direction: 'auto',
          className: 'optimized-tooltip'
        })
      }

      markers.addLayer(marker)
    }
  })

  return markers
}

// Fonction pour créer une couche GeoJSON optimisée (EXISTANTE MAINTENANT UTILISÉE)
function createOptimizedGeoJSONLayer(features) {
  // Simplifier les geometries pour améliorer les performances
  const simplifiedFeatures = features.map(feature => ({
    ...feature,
    geometry: simplifyGeometry(feature.geometry)
  }))

  return L.geoJSON(simplifiedFeatures, {
    // Simplification géométrique
    simplifyTolerance: 0.01,
    smoothFactor: 1.0,

    // Style optimisé
    style: {
      color: "#3388ff",
      weight: 1,
      opacity: 0.7,
      fillColor: "#3388ff",
      fillOpacity: 0.2
    },

    // Gestion des événements optimisée
    onEachFeature: function (feature, layer) {
      // Délégation d'événements pour améliorer les performances
      layer.on('mouseover', function (e) {
        if (currentLayer) {
          resetFeatureStyle(currentLayer)
        }
        currentLayer = layer
        highlightFeatureOptimized(layer, feature, e)
      })

      layer.on('mouseout', function () {
        if (currentLayer === layer) {
          resetFeatureStyle(layer)
          currentLayer = null
        }
      })

      // Popup au click
      layer.on('click', function (e) {
        const content = createTooltipContent(feature.properties)
        L.popup()
          .setLatLng(e.latlng)
          .setContent(content)
          .openOn(map)
      })
    }
  })
}

// Simplifier la géométrie pour améliorer les performances
function simplifyGeometry(geometry) {
  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
    // Réduire le nombre de points dans les polygones
    return {
      ...geometry,
      coordinates: simplifyCoordinates(geometry.coordinates, 0.0001)
    }
  }
  return geometry
}

function simplifyCoordinates(coordinates, tolerance) {
  // Implémentation simplifiée de l'algorithme de Douglas-Peucker
  if (coordinates.length <= 2) return coordinates

  const result = [coordinates[0]]
  for (let i = 1; i < coordinates.length - 1; i++) {
    if (i % 10 === 0) { // Prendre 1 point sur 10
      result.push(coordinates[i])
    }
  }
  result.push(coordinates[coordinates.length - 1])

  return result
}

function highlightFeatureOptimized(layer, feature, event) {
  layer.setStyle({
    weight: 3,
    color: '#ff7800',
    fillOpacity: 0.7
  })

  if (!layer.getPopup() || !layer.getPopup().isOpen()) {
    const content = createTooltipContent(feature.properties)
    layer.bindPopup(content, {
      maxWidth: 300,
      maxHeight: 200,
      className: 'optimized-popup'
    }).openPopup()
  }
}

function createTooltipContent(properties) {
  if (!properties || Object.keys(properties).length === 0) {
    return "<div class='tooltip-content'>Aucune propriété disponible</div>"
  }

  let html = "<div class='tooltip-content'>"

  for (let key in properties) {
    if (properties[key] !== null && properties[key] !== undefined) {
      let value = properties[key]
      // Nettoyer les valeurs
      if (value === null || value === undefined) {
        value = "N/A"
      } else if (typeof value === 'string') {
        // Limiter la longueur pour éviter les tooltips trop larges
        if (value.length > 200) {
          value = value.substring(0, 200) + '...'
        }
        value = value.replace(/</g, '&lt;').replace(/>/g, '&gt;') // Échapper le HTML
      }
      html += `<div style='margin-bottom: 4px;'><strong style='color: #2d3748;'>${key}:</strong> <span style='color: #4a5568;'>${value}</span></div>`
    }
  }

  html += "</div>"
  return html
}

function positionTooltip(event) {
  if (!tooltip.value) return

  const offset = 15
  tooltip.value.style.left = (event.originalEvent.pageX + offset) + 'px'
  tooltip.value.style.top = (event.originalEvent.pageY + offset) + 'px'
}

function resetFeatureStyle() {
  if (currentLayer) {
    currentLayer.setStyle({
      color: "blue",
      weight: 1,
      fillColor: "lightblue",
      fillOpacity: 0.4
    })

    if (tooltip.value) {
      tooltip.value.style.display = 'none'
    }

    currentLayer = null
  }
}

function checkElectronAPI() {
  console.log('=== DEBUG ELECTRON API ===')
  console.log('window:', typeof window)
  console.log('window.electronAPI:', window.electronAPI)
  console.log('typeof window.electronAPI:', typeof window.electronAPI)

  if (window.electronAPI) {
    console.log('electronAPI methods:', Object.keys(window.electronAPI))
    console.log('execOgr2ogr disponible:', typeof window.electronAPI.execOgr2ogr)
  } else {
    console.log('electronAPI n\'est pas disponible')
  }
  console.log('========================')
}

function refreshApp() {
  // Réinitialiser tous les états
  selectedTabFile.value = null
  selectedTabFilePath.value = null
  selectedShpFile.value = null
  selectedShpFilePath.value = null
  isConverting.value = false
  isLoadingConvertedShp.value = false
  isLoadingSelectedShp.value = false
  conversionResult.value = null
  convertedShpPath.value = null
  error.value = null
  selectedLanguage.value = 'fr'

  // Nettoyer la carte
  if (geojsonLayer) {
    map.removeLayer(geojsonLayer)
    geojsonLayer = null
  }

  if (currentLayer) {
    currentLayer = null
  }

  // Réinitialiser la vue de la carte
  if (map) {
    map.setView([31.7, -6], 6)
    addTileLayer('fr') // Remettre en français
  }

  // Cacher le tooltip
  if (tooltip.value) {
    tooltip.value.style.display = 'none'
  }

  console.log('Application rafraîchie')
}
</script>

<style scoped>
.converter-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: #f5f7fa;
}

#map {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1;
  border-radius: 0;
}

.control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 380px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 16px;
  box-shadow:
    0 10px 40px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(255, 255, 255, 0.1);
  z-index: 1000;
  max-height: 85vh;
  overflow-y: auto;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: slideInRight 0.3s ease-out;
}

.panel-header {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px 16px 0 0;
  position: relative;
  overflow: hidden;
}

.panel-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%);
}

.panel-header h3 {
  margin: 0;
  color: white;
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  position: relative;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  letter-spacing: -0.02em;
}

.panel-content {
  padding: 24px;
  background: rgba(255, 255, 255, 0.6);
}

.section {
  margin-bottom: 28px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  position: relative;
}

/* Espacement pour le bouton rafraîchir */
.section:last-child {
  padding-bottom: 30px !important;
  margin-bottom: 10px !important;
}

.section::before {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 40px;
  height: 2px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 2px;
}

.section h4 {
  margin: 0 0 16px 0;
  color: #2d3748;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section h4::before {
  content: '▸';
  color: #667eea;
  font-size: 14px;
}

.language-select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 10px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.9);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=US-ASCII,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 5'><path fill='%23666' d='M2 0L0 2h4zm0 5L0 3h4z'/></svg>");
  background-repeat: no-repeat;
  background-position: right 16px center;
  background-size: 12px;
  padding-right: 40px;
}

.language-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
  transform: translateY(-1px);
}

.language-select:hover {
  border-color: rgba(0, 0, 0, 0.2);
}

.file-section {
  margin-bottom: 16px;
}

.file-select-btn {
  width: 100%;
  padding: 14px 20px;
  border: 2px dashed #cbd5e0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  color: #4a5568;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  font-family: inherit;
  position: relative;
  overflow: hidden;
}

.file-select-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.1), transparent);
  transition: left 0.6s;
}

.file-select-btn:hover::before {
  left: 100%;
}

.file-select-btn:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
  border-style: solid;
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
}

.file-select-btn:active {
  transform: translateY(0);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.file-info {
  font-size: 13px;
  color: #718096;
  margin-top: 8px;
  word-break: break-all;
  padding: 12px;
  background: rgba(237, 242, 247, 0.8);
  border-radius: 8px;
  border-left: 4px solid #667eea;
  line-height: 1.5;
  font-weight: 500;
  animation: fadeInUp 0.3s ease-out;
}

.convert-btn, .load-btn, .refresh-btn {
  width: 100%;
  padding: 16px 20px;
  border: none;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: 0;
  font-size: 15px;
  text-align: center;
  display: block;
  position: relative;
  overflow: hidden;
  font-family: inherit;
  letter-spacing: -0.01em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.convert-btn::before, .load-btn::before, .refresh-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.6s;
}

.convert-btn:hover::before, .load-btn:hover::before, .refresh-btn:hover::before {
  left: 100%;
}

.button-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  position: relative;
  z-index: 2;
}

.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.convert-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.convert-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #5a6fd8 0%, #6a42a0 100%);
  transform: translateY(-3px);
  box-shadow: 0 8px 30px rgba(102, 126, 234, 0.5);
}

.convert-btn:active:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.convert-btn:disabled {
  background: #cbd5e0;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
  opacity: 0.7;
}

.load-btn {
  background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(72, 187, 120, 0.4);
  margin-top: 12px;
}

.load-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #3fa76c 0%, #2f855a 100%);
  transform: translateY(-3px);
  box-shadow: 0 8px 30px rgba(72, 187, 120, 0.5);
}

.load-btn:active:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(72, 187, 120, 0.4);
}

.load-btn:disabled {
  background: #cbd5e0;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
  opacity: 0.7;
}

.refresh-btn {
  background: linear-gradient(135deg, #667eea 0%, #667eea 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.refresh-btn:hover {
  background: linear-gradient(135deg, #667eea 0%, #667eea 100%);
  transform: translateY(-3px);
  box-shadow: 0 8px 30px rgba(102, 126, 234, 0.3);
}

.refresh-btn:active {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.result-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  animation: fadeInUp 0.4s ease-out;
}

.result-message {
  padding: 14px 16px;
  border-radius: 10px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  line-height: 1.5;
  animation: bounceIn 0.5s ease-out;
}

.result-message.success {
  background: linear-gradient(135deg, #c6f6d5 0%, #9ae6b4 100%);
  color: #22543d;
  border: 1px solid #9ae6b4;
  box-shadow: 0 2px 8px rgba(34, 84, 61, 0.1);
}

.result-message.error {
  background: linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%);
  color: #742a2a;
  border: 1px solid #feb2b2;
  box-shadow: 0 2px 8px rgba(116, 42, 42, 0.1);
}

.error-message {
  color: #e53e3e;
  font-size: 14px;
  margin-top: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%);
  border-radius: 10px;
  border: 1px solid #feb2b2;
  font-weight: 600;
  animation: shake 0.5s ease-in-out;
  line-height: 1.5;
}

.tooltip {
  position: absolute;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 16px;
  max-height: 280px;
  overflow-y: auto;
  border-radius: 12px;
  box-shadow:
    0 10px 40px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(255, 255, 255, 0.1);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 13px;
  z-index: 1000;
  display: none;
  max-width: 320px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  line-height: 1.5;
  animation: tooltipFadeIn 0.2s ease-out;
}

.tooltip b {
  color: #2d3748;
  margin-bottom: 8px;
  display: block;
  font-weight: 700;
  font-size: 14px;
}

/* Animations */
@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Scrollbar personnalisée */
.control-panel::-webkit-scrollbar {
  width: 8px;
}

.control-panel::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  margin: 8px 0;
}

.control-panel::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.control-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

.tooltip::-webkit-scrollbar {
  width: 6px;
}

.tooltip::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.tooltip::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.tooltip::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* Responsive */
@media (max-width: 768px) {
  .control-panel {
    width: calc(100% - 40px);
    right: 20px;
    left: 20px;
    top: 20px;
    max-height: 70vh;
  }

  .panel-content {
    padding: 20px;
  }
}

@media (max-width: 480px) {
  .control-panel {
    width: calc(100% - 24px);
    right: 12px;
    left: 12px;
    top: 12px;
    border-radius: 12px;
  }

  .panel-header {
    padding: 16px 20px;
    border-radius: 12px 12px 0 0;
  }

  .panel-header h3 {
    font-size: 18px;
  }

  .panel-content {
    padding: 16px;
  }

  .section {
    margin-bottom: 20px;
    padding-bottom: 20px;
  }
}

/* États de focus pour l'accessibilité */
button:focus, select:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
}

/* Amélioration de la sélection de texte */
::selection {
  background: rgba(102, 126, 234, 0.2);
  color: inherit;
}

/* Support du mode sommeil */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Support du contraste élevé */
@media (prefers-contrast: high) {
  .control-panel {
    border: 2px solid #000;
  }

  .section {
    border-bottom: 2px solid #000;
  }
}

/* Support de la préférence de mouvement réduit */
@media (prefers-reduced-motion: reduce) {
  .convert-btn, .load-btn, .refresh-btn, .file-select-btn {
    transition: none;
  }

  .loading-spinner {
    animation: none;
  }
}
/* Styles optimisés pour les performances */
.optimized-tooltip {
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  font-size: 13px;
  max-width: 400px;
  max-height: 400px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

.optimized-popup {
  max-width: 500px;
  max-height: 400px;
}

.tooltip-content {
  font-size: 13px;
  line-height: 1.4;
}

.tooltip-content div {
  margin-bottom: 6px;
  word-break: break-word;
}

/* Indicateur de chargement */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.progress-bar {
  width: 300px;
  height: 20px;
  background: #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
  margin: 10px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  color: #333;
  margin-top: 10px;
}
</style>

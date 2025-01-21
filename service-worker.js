const CACHE_NAME = 'game-cache-v1';
const FILES_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/test.js',
    '/babylon.js',
    '/babylonjs.loaders.min.js',
    '/face-api.min.js',
    '/assets/Textures/colormap.png',
    '/assets/ambulance.glb',
    '/assets/backgroundcar.jpg',
    '/assets/Chlub-3zaZ.ttf',
    '/assets/Crash_Hard-004.wav',
    '/assets/delivery-flat.glb',
    '/assets/delivery.glb',
    '/assets/firetruck.glb',
    '/assets/garbage-truck.glb',
    '/assets/Muscle_Car_Gear3 (Loop).wav',
    '/assets/police.glb',
    '/assets/race-future.glb',
    '/assets/road.jpg',
    '/assets/sedan-sports.glb',
    '/assets/suv-luxury.glb',
    '/assets/taxi.glb',
    '/assets/tractor-shovel.glb',
    '/assets/tractor-police.glb',
    '/assets/tractor.glb',
    '/assets/truck-flat.glb',
    '/assets/truck.glb',
    '/assets/van.glb',
    '/models/face_landmark_68_model-shard1',
    '/models/face_landmark_68_model-weights_manifest.json',
    '/models/face_recognition_model-shard1',
    '/models/face_recognition_model-shard2',
    '/models/face_recognition_model-weights_manifest.json',
    '/models/ssd_mobilenetv1_model-shard1',
    '/models/ssd_mobilenetv1_model-shard2',
    '/models/ssd_mobilenetv1_model-weights_manifest.json',
    '/models/tiny_face_detector_model-shard1',
    '/models/tiny_face_detector_model-weights_manifest.json',
    '/package.json',
    '/package-lock.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching all game files');
            return cache.addAll(FILES_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        }).catch(() => {
            console.error('Failed to fetch resource:', event.request.url);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});


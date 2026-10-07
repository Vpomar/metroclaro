/* Service worker mínimo.
   Chrome exige uno para ofrecer la instalación. No cachea nada:
   así la aplicación siempre trae la versión más nueva y los datos
   nunca quedan viejos. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

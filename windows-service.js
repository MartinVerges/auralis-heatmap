
const Service = require('node-windows').Service;

const svc = new Service({
  name: 'Heatmap Service',
  description: 'Auralis Heatmap as a Windows service.',
  script: 'C:\\heatmap-app\\server.js'
});

svc.on('install', () => {
  svc.start();
});

svc.install();

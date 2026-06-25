const fs = require('fs');
const path = require('path');

const originalReadFileSync = fs.readFileSync.bind(fs);
const gamePath = path.join(__dirname, 'game.js');
const gameCorePath = path.join(__dirname, 'game-core.js');

fs.readFileSync = (filePath, ...args) => {
  if (path.resolve(filePath) === gamePath) return originalReadFileSync(gameCorePath, ...args);
  return originalReadFileSync(filePath, ...args);
};

require('./regression-tests-core.js');
require('./core-integration-check.js');

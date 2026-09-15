import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { app as apiApp } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.join(__dirname, 'dist');
const webPort = Number(process.env.PORT || 3001);

const webApp = express();

webApp.use(express.json());
webApp.use('/api', apiApp);
webApp.use(express.static(clientDist));

webApp.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

webApp.listen(webPort, () => {
  console.log(`Noxen web app is running on http://localhost:${webPort}`);
});

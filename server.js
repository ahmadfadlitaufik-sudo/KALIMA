import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint for Cloud Run container probes
app.get('/_health', (req, res) => {
  res.status(200).send('OK');
});

// Serve compiled static assets from dist
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1h',
  etag: true,
}));

// Fallback all routes to index.html for React SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Kalima Web App production server listening on 0.0.0.0:${PORT}`);
});

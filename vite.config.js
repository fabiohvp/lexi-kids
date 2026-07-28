import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
import https from 'https'

try {
  if (!fs.existsSync('public')) {
    fs.mkdirSync('public', { recursive: true });
  }
  if (fs.existsSync('level-up.mp3')) {
    fs.copyFileSync('level-up.mp3', 'public/level-up.mp3');
  }
  if (fs.existsSync('point-up.mp3')) {
    fs.copyFileSync('point-up.mp3', 'public/point-up.mp3');
  }

  const flagsDir = path.resolve('public/flags');
  if (!fs.existsSync(flagsDir)) {
    fs.mkdirSync(flagsDir, { recursive: true });
  }

  const countryCodes = [
    'de', 'ao', 'ar', 'au', 'at', 'be', 'bo', 'br', 'ca', 'cl',
    'cn', 'co', 'kr', 'cr', 'cu', 'dk', 'eg', 'ec', 'es', 'us',
    'fr', 'gr', 'nl', 'in', 'gb-eng', 'it', 'jp', 'mx', 'mz', 'no',
    'py', 'pe', 'pt', 'ru', 'se', 'ch', 'uy', 've'
  ];

  countryCodes.forEach(code => {
    const filePath = path.join(flagsDir, `${code}.svg`);
    if (!fs.existsSync(filePath)) {
      const url = `https://flagcdn.com/${code}.svg`;
      const file = fs.createWriteStream(filePath);
      https.get(url, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
        } else {
          file.close();
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      }).on('error', () => {
        file.close();
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
    }
  });
} catch (err) {
  console.error(err);
}

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
})



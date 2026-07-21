import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'fs'

try {
  if (fs.existsSync('level-up.mp3')) {
    fs.copyFileSync('level-up.mp3', 'public/level-up.mp3');
  }
  if (fs.existsSync('point-up.mp3')) {
    fs.copyFileSync('point-up.mp3', 'public/point-up.mp3');
  }
} catch (err) {
  console.error(err);
}

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
})



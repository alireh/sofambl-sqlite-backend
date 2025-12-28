// esbuild.config.js
import esbuild from 'esbuild';
import fs from 'fs/promises';

await esbuild.build({
  entryPoints: ['server.js'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/server.js',
  packages: 'external',
  external: [
    'better-sqlite3',
    'bcryptjs', 
    'jsonwebtoken',
    'dotenv'
  ],
  loader: {
    '.js': 'js',
    '.json': 'json'
  }
});

// کپی فایل‌های ضروری به dist
try {
  await fs.mkdir('dist', { recursive: true });
  
  const filesToCopy = ['init-db.js', 'db.js', 'auth.js'];
  for (const file of filesToCopy) {
    try {
      await fs.copyFile(file, `dist/${file}`);
      console.log(`✅ Copied ${file} to dist/`);
    } catch {
      console.log(`⚠️  Could not copy ${file}`);
    }
  }
  
  console.log('✅ Build completed successfully');
} catch (error) {
  console.error('❌ Build error:', error);
}
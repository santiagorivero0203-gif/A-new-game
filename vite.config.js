import { execSync } from 'node:child_process';

/**
 * Resuelve un identificador corto de compilación (hash de commit en CI o Git local)
 * para detectar versiones cacheadas en dispositivos móviles.
 * @returns {string} Etiqueta corta de compilación o 'local' como respaldo.
 */
function resolveBuildTag() {
  const envSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_REF || process.env.GITHUB_SHA;
  if (envSha) return envSha.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim() || 'local';
  } catch {
    return 'local';
  }
}

export default {
  define: {
    __APP_VERSION__: JSON.stringify(`v·${resolveBuildTag()}`)
  },
  server: {
    port: 3000,
    open: true,
    headers: {
      'Cache-Control': 'no-store'
    }
  },
  build: {
    target: 'esnext'
  }
};

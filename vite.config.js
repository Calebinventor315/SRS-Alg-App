import { defineConfig, loadEnv } from 'vite';

/**
 * Serves /api/generate-deck locally during `npm run dev` using the same
 * Vercel serverless handler in api/generate-deck.js.
 */
function localApiPlugin() {
  return {
    name: 'local-api-generate-deck',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      if (env.OPENROUTER_API_KEY && !process.env.OPENROUTER_API_KEY) {
        process.env.OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
      }

      server.middlewares.use('/api/generate-deck', async (req, res, next) => {
        try {
          let rawBody = '';
          if (req.method === 'POST') {
            rawBody = await new Promise((resolve, reject) => {
              let data = '';
              req.on('data', (chunk) => {
                data += chunk;
              });
              req.on('end', () => resolve(data));
              req.on('error', reject);
            });
          }

          const { default: handler } = await import('./api/generate-deck.js');
          const reqWrapper = {
            method: req.method,
            headers: req.headers,
            body: rawBody ? JSON.parse(rawBody) : {}
          };

          const resWrapper = {
            statusCode: 200,
            status(code) {
              this.statusCode = code;
              return this;
            },
            json(payload) {
              res.statusCode = this.statusCode;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(payload));
              return this;
            }
          };

          await handler(reqWrapper, resWrapper);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Local API error' }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [localApiPlugin()]
});

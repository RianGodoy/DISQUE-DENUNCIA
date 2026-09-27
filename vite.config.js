import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const temBanco = Boolean(env.VITE_SUPABASE_URL && (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY))

  return {
    plugins: [
      react(),
      {
        // Publicar sem banco coloca no ar um canal que não entrega nada a
        // ninguém. O build deixa, porque serve para mostrar o sistema, mas
        // avisa em letras grandes.
        name: 'canal-aviso-sem-banco',
        apply: 'build',
        buildEnd() {
          // Na Vercel (produção de verdade) um site sem banco não entrega
          // denúncia a ninguém: aí o build falha em vez de só avisar.
          if (!temBanco && process.env.VERCEL) {
            this.error(
              'Build na Vercel SEM banco: VITE_SUPABASE_URL e a chave pública não chegaram. ' +
              'Confira o arquivo .env.production ou as Environment Variables do projeto na Vercel.',
            )
          }
          if (!temBanco) {
            this.warn(
              'Build SEM banco (VITE_SUPABASE_URL ou a chave pública vazias): o site vai ' +
              'no MODO DEMONSTRAÇÃO e as denúncias ficam só no navegador de quem ' +
              'envia. Não divulgue esse endereço aos trabalhadores.',
            )
          }
        },
      },
    ],
    server: { port: 5190 },
    build: { outDir: 'dist', sourcemap: false },
  }
})

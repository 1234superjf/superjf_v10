/** @type {import('next').NextConfig} */
const nextConfig = {
	typescript: {
		ignoreBuildErrors: true,
	},
	eslint: {
		ignoreDuringBuilds: true,
	},
	webpack: (config, { isServer }) => {
		// Evita que Webpack resuelva 'canvas' (Node-only). pdfjs-dist incluye una rama Node que lo requiere,
		// pero en el navegador usamos la build ESM (pdf.mjs) que no lo necesita.
		config.resolve = config.resolve || {}
		config.resolve.alias = {
			...(config.resolve.alias || {}),
			canvas: false,
		}
		config.resolve.fallback = {
			...(config.resolve.fallback || {}),
			canvas: false,
		}
		return config
	},
	experimental: {
		serverActions: {
			allowedOrigins: [
				'localhost:3000',
				'localhost:9002',
				'*.github.dev',
				'*.gitpod.io',
				'*.repl.co',
				'*.app.github.dev',
			],
			bodySizeLimit: '2mb',
		},
	},
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'placehold.co',
				port: '',
				pathname: '/**',
			},
		],
	},
	transpilePackages: ['genkit', 'dotprompt'],
}

module.exports = nextConfig


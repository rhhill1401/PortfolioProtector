/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
	theme: {
		extend: {
			colors: {
				gray: {
					850: '#1a1e2e',
				},
			},
		},
	},
	plugins: [],
};

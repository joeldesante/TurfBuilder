// tailwind.config.js
import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{html,js,svelte,ts}'],
    theme: {
    extend: {},
    },
    plugins: [
        typography, // Add the typography plugin here
    ],
};
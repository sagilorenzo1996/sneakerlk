// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
    // CRUCIAL: Tell Tailwind where to find your files to scan for classes
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        // 🎨 Custom Color Palette
        colors: {
          'primary-neon': '#FF0054',   // Hot Pink/Neon (Main accent)
          'secondary-teal': '#00FFC0', // Cyan/Teal (Shadow/Divider)
          'accent-gold': '#FFD700',    // Gold/Yellow (Highlight/Borders)
          'bg-dark': '#2D2D2D',        // Dark Grey/Black (Body background)
          'bg-deep': '#1e1e1e',        // Deeper Black (Stock section background)
          'whatsapp-green': '#25D366', // WhatsApp Green
        },
        // ✍️ Custom Fonts
        fontFamily: {
          // 'Bungee Inline' for regular block text
          'sans': ['Bungee Inline', 'sans-serif'], 
          // 'Press Start 2P' for headings, buttons, and titles
          'retro-title': ['"Press Start 2P"', 'cursive'], 
        },
        // 🖼️ Retro Background Pattern Utility
        backgroundImage: {
          // This utility class will be used on the Socials section
          'retro-pattern': 'repeating-linear-gradient(45deg, #2D2D2D, #2D2D2D 10px, #1e1e1e 10px, #1e1e1e 20px)',
        },
        // Custom border width for pronounced retro lines
        borderWidth: {
          '3': '3px',
          '4': '4px',
          '5': '5px',
        }
      },
    },
    plugins: [],
  }
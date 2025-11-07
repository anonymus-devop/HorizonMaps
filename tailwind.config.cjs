/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        horizonBlue: "#4facfe",
        horizonViolet: "#8e2de2",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

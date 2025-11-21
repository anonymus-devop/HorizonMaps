module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        glass: "rgba(255,255,255,0.08)",
      },
      backdropBlur: {
        lgx: "28px",
      },
      keyframes: {
        floatUp: {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" }
        },
        iosSmooth: {
          "0%": { opacity: 0.2, transform: "scale(0.98)" },
          "100%": { opacity: 1, transform: "scale(1)" }
        }
      },
      animation: {
        floatUp: "floatUp 0.4s ease-out",
        ios: "iosSmooth 0.35s ease-out"
      }
    },
  },
  plugins: [],
};

/** SwachhSetu tokens: Godavari river teal, marigold freshness stamp, distinct status hues. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        river: { DEFAULT: "#0E5E6F", dark: "#0A4552", light: "#E3F0F2" },
        ink: { DEFAULT: "#1E2A32", muted: "#5B6B73" },
        paper: "#F6F8F7",
        line: "#DDE3E1",
        marigold: { DEFAULT: "#E8A317", deep: "#9A6A00", light: "#FDF3DC" },
        st: {
          verified: "#2E7D4F",
          issue: "#C2410C",
          maintenance: "#2563EB",
          unavailable: "#6B7280",
          overdue: "#7C3AED",
        },
      },
      fontFamily: {
        sans: ['"Noto Sans"', '"Noto Sans Telugu"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: v("ink"),
        turf: v("turf"),
        "turf-2": v("turf-2"),
        chalk: v("chalk"),
        muted: v("muted"),
        volt: v("volt"),
        flare: v("flare"),
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', "Impact", "sans-serif"],
        sans: ["Barlow", "system-ui", "sans-serif"],
        mono: ['"Chivo Mono"', "ui-monospace", "monospace"],
      },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { rise: "rise .5s cubic-bezier(.2,.7,.2,1) both" },
    },
  },
} satisfies Config;

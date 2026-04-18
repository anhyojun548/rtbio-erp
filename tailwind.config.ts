import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 프로토타입에서 사용한 색상 팔레트
        rtbio: {
          primary: "#0ea5e9",
          secondary: "#64748b",
          accent: "#f59e0b",
        },
      },
    },
  },
  plugins: [],
};

export default config;

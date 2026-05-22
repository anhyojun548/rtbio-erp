import type { Config } from "tailwindcss";

/**
 * RTBIO ERP — Tailwind 설정
 *
 * 2026-05-22: prototype/css/shared.css 의 디자인 토큰을 그대로 매핑.
 * - prototype 디자인을 React 컴포넌트에 1:1 이식하기 위함
 * - 모든 className 자동완성 + IntelliSense 지원
 * - CSS 변수도 :root 에 동시 노출(globals.css) → 인라인 style 도 가능
 */
const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── 프로토타입 핵심 팔레트 ─────────────────────────
        primary: {
          DEFAULT: "#1B3A5C",
          light:   "#2B5797",
          lighter: "#E8EEF5",
        },
        accent: {
          DEFAULT: "#00A8B5",
          dark:    "#00838F",
          light:   "#E0F7FA",
        },
        success: {
          DEFAULT: "#2E7D32",
          light:   "#E8F5E9",
        },
        warning: {
          DEFAULT: "#F57C00",
          light:   "#FFF3E0",
        },
        danger: {
          DEFAULT: "#D32F2F",
          light:   "#FFEBEE",
        },
        purple: {
          DEFAULT: "#7C3AED",
          light:   "#F3E8FF",
        },

        // ── 텍스트/배경/보더 ────────────────────────────
        ink: {
          DEFAULT:   "#1A1A2E",   // var(--text)
          secondary: "#6B7280",   // var(--text-secondary)
          muted:     "#9CA3AF",   // var(--text-muted)
        },
        surface: "#FFFFFF",        // var(--surface)
        canvas:  "#F8F9FB",        // var(--bg)
        border:  "#E5E7EB",        // var(--border)

        // ── 4팀 발송자 배지 (notice.js 와 동기) ──────────
        team: {
          admin: { DEFAULT: "#1B3A5C", bg: "#E3F2FD" }, // 경영지원
          exec:  { DEFAULT: "#B45309", bg: "#FFF3E0" }, // 영업
          qc:    { DEFAULT: "#166534", bg: "#E8F5E9" }, // 품질
          ceo:   { DEFAULT: "#7C3AED", bg: "#F3E8FD" }, // 임원
        },

        // ── 상태 배지 (주문 8단계 등) ─────────────────────
        status: {
          draft:     "#9CA3AF", // gray
          submitted: "#2B5797", // primary-light
          confirmed: "#00A8B5", // accent
          shipping:  "#7C3AED", // purple
          completed: "#2E7D32", // success
          held:      "#F57C00", // warning
          rejected:  "#D32F2F", // danger
          cancelled: "#6B7280", // ink-secondary
        },

        // legacy alias (기존 rtbio.* 사용 코드 호환)
        rtbio: {
          primary:   "#1B3A5C",
          secondary: "#6B7280",
          accent:    "#00A8B5",
        },
      },

      fontFamily: {
        sans: [
          "-apple-system",
          "Malgun Gothic",
          "Segoe UI",
          "Apple SD Gothic Neo",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Consolas", "monospace"],
      },

      fontSize: {
        // prototype 의 .text-* 클래스 매칭
        display: ["28px", { lineHeight: "1.3",  fontWeight: "700" }],
        h1:      ["22px", { lineHeight: "1.35", fontWeight: "700" }],
        h2:      ["18px", { lineHeight: "1.4",  fontWeight: "600" }],
        h3:      ["16px", { lineHeight: "1.45", fontWeight: "600" }],
        body:    ["15px", { lineHeight: "1.6",  fontWeight: "400" }],
        caption: ["13px", { lineHeight: "1.5" }],
        tiny:    ["11px", { lineHeight: "1.4" }],
      },

      borderRadius: {
        // prototype 의 --radius-* 매칭
        DEFAULT: "12px", // var(--radius)
        sm:      "8px",  // var(--radius-sm)
        xs:      "6px",  // var(--radius-xs)
      },

      boxShadow: {
        // prototype 의 --shadow-* 매칭
        sm: "0 1px 3px rgba(0, 0, 0, 0.06)",
        md: "0 4px 12px rgba(0, 0, 0, 0.08)",
        lg: "0 8px 24px rgba(0, 0, 0, 0.12)",
        // 사이드바 dark 배경의 inset glow 등 특수 그림자
        sidebar: "inset -1px 0 0 rgba(255, 255, 255, 0.06)",
      },

      spacing: {
        // prototype 의 일반적인 spacing 단위 보강
        "safe-bottom": "env(safe-area-inset-bottom, 0px)",
      },

      transitionDuration: {
        DEFAULT: "150ms",
      },

      // 사이드바 너비 등 자주 쓰는 사이즈
      width: {
        sidebar: "250px",
      },
      margin: {
        sidebar: "250px",   // 본문이 사이드바 옆에 위치하도록
      },
      maxWidth: {
        modal: "720px",   // 모달 본문 최대 너비
      },
      maxHeight: {
        modal: "90vh",
      },

      zIndex: {
        dropdown: "50",
        sticky:   "60",
        modal:    "70",
        toast:    "80",
        popup:    "90",   // 플로팅 팝업
      },
    },
  },
  plugins: [],
};

export default config;

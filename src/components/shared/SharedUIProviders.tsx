"use client";

/**
 * SharedUIProviders — 글로벌 UI 위젯의 마운트 포인트
 *
 * Root layout 의 <body> 어딘가에 한 번 마운트하면
 * 어디서든 toast / confirmDialog / openFloatingPopup 호출 가능.
 *
 * 사용:
 *   // src/app/layout.tsx
 *   <body>
 *     {children}
 *     <SharedUIProviders />
 *   </body>
 */

import { ToastProvider } from "./Toast";
import { DialogProvider } from "./Modal";
import { FloatingPopupProvider } from "./FloatingPopup";

export function SharedUIProviders() {
  return (
    <>
      <ToastProvider />
      <DialogProvider />
      <FloatingPopupProvider />
    </>
  );
}

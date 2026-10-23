"use client";
import { useRef, type PointerEvent, type RefObject } from "react";

// Closes a native <dialog> when a primary pointer both starts and ends on the
// backdrop without dragging. Clicks inside, or drags that leave the dialog,
// are ignored. Close and Escape are handled by the dialog itself.
export function useBackdropDismiss(ref: RefObject<HTMLDialogElement | null>) {
  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  function outside(event: PointerEvent<HTMLDialogElement>) {
    const box = ref.current?.getBoundingClientRect();
    return (
      event.target === event.currentTarget &&
      !!box &&
      (event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom)
    );
  }
  return {
    onPointerDown(event: PointerEvent<HTMLDialogElement>) {
      press.current =
        event.button === 0 && outside(event)
          ? { id: event.pointerId, x: event.clientX, y: event.clientY }
          : null;
    },
    onPointerUp(event: PointerEvent<HTMLDialogElement>) {
      const start = press.current;
      press.current = null;
      if (
        start &&
        start.id === event.pointerId &&
        outside(event) &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8
      )
        ref.current?.close();
    },
    onPointerCancel() {
      press.current = null;
    },
  };
}

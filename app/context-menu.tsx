"use client";

import { useEffect, useRef } from "react";

interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // 延迟添加以避免立即触发（当前点击事件还未冒泡完成）
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  // 确保菜单在视口内
  const adjustedX = Math.min(x, window.innerWidth - 160);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 40);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: adjustedX,
        top: adjustedY,
        zIndex: 1000,
        minWidth: 140,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        padding: "4px 0",
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          onClick={() => { item.onClick(); onClose(); }}
          style={{
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: 13,
            color: item.danger ? "var(--color-danger)" : "var(--color-text)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}

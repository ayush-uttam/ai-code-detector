import { useEffect } from "react";

export function useMouseHalo(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const halo = document.getElementById("mouse-halo");
    if (!halo) return;

    let lastX = 0;
    let lastY = 0;
    let rafId: number;

    const handleMouseMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      
      cancelAnimationFrame(rafId);
      
      rafId = requestAnimationFrame(() => {
        halo.style.transform = `translate3d(${lastX}px, ${lastY}px, 0)`;
        halo.style.opacity = "1";
      });
    };

    const handleMouseLeave = () => {
      halo.style.opacity = "0";
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(rafId);
    };
  }, [active]);
}

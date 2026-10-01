// A quiet ember glow + fine grid behind the floating hero illustration —
// recolored to the brand's actual accent instead of a generic template blue.
const gridStyle = (color) => ({
  backgroundImage: [
    `linear-gradient(${color} 1px, transparent 1px)`,
    `linear-gradient(90deg, ${color} 1px, transparent 1px)`,
  ].join(","),
  backgroundSize: "26px 26px",
});

const darkGridMask =
  "radial-gradient(ellipse 68% 58% at 50% 48%, #000 8%, #000 42%, transparent 78%)";

export function AuthHeroPattern() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_50%_38%,color-mix(in_oklab,var(--accent)_28%,transparent),transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden bg-linear-to-b from-background/0 via-transparent to-background dark:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ ...gridStyle("color-mix(in oklab, var(--foreground) 8%, transparent)"), maskImage: darkGridMask, WebkitMaskImage: darkGridMask }}
      />
    </>
  );
}

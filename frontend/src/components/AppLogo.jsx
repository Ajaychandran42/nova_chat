export const APP_NAME = "Phoenix";

export function AppLogo({ className = "", size = 32, alt = APP_NAME }) {
  const shared = `shrink-0 rounded-[22%] object-cover select-none ${className}`;

  return (
    <span className="contents" style={{ width: size, height: size }}>
      {/* the dark-mode mark has a black background, the light-mode mark a
         cream one — swap via Tailwind's `dark:` class so no theme context
         is needed (this renders before ThemeProvider mounts, on PageLoader) */}
      <img
        src="/logo-light.jpg"
        alt={alt}
        width={size}
        height={size}
        className={`${shared} dark:hidden`}
        draggable={false}
      />
      <img
        src="/logo-dark.jpg"
        alt={alt}
        width={size}
        height={size}
        className={`${shared} hidden dark:block`}
        draggable={false}
      />
    </span>
  );
}

import { APP_NAME } from "../AppLogo";
import { AuthHeroPattern } from "./AuthHeroPattern";

const heroPanelClassName = [
  "relative flex min-h-[min(320px,42vh)] shrink-0 flex-col overflow-hidden",
  "bg-background",
  "md:w-[44%] md:max-w-xl md:border-r md:border-border",
  "lg:w-[42%] lg:max-w-none",
].join(" ");

const heroImageClassName = [
  "h-auto max-h-[min(44vh,380px)] w-[min(92%,19rem)]",
  "animate-[auth-float-y_4.5s_ease-in-out_infinite]",
  "object-contain object-center select-none motion-reduce:animate-none",
  "sm:w-[min(88%,21rem)] md:max-h-[min(52vh,440px)] md:w-[min(90%,22rem)]",
].join(" ");

export function AuthHeroPanel() {
  return (
    <section className={heroPanelClassName}>
      <AuthHeroPattern />

      <div className="relative z-1 flex flex-1 flex-col px-6 pb-6 pt-8 md:px-8 md:pb-8 md:pt-10">
        <div className="text-center md:text-left">
          <h2 className="font-display text-balance text-[1.7rem] leading-[1.1] font-semibold tracking-tight text-foreground sm:text-[2rem]">
            Rise into {APP_NAME}
          </h2>
          <p className="mx-auto mt-2.5 max-w-[22rem] text-pretty text-[13px] leading-relaxed text-muted md:mx-0 md:max-w-none">
            Chats, photos, and reactions stay end-to-end encrypted — sign in on the right to
            continue.
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center py-6 md:py-4">
          <img
            src="/auth.png"
            alt=""
            width={640}
            height={640}
            className={heroImageClassName}
            draggable={false}
            decoding="async"
          />
        </div>

        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-muted md:justify-start md:text-left">
          <span className="inline-block size-1.5 rounded-full bg-success" aria-hidden />
          Encrypted on your device before it ever leaves
        </p>
      </div>
    </section>
  );
}

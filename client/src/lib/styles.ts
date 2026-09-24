// Tailwind class lists for patterns shared across pages; one-off styles stay inline.

export const eyebrow =
  "mb-[17px] flex items-center gap-2.5 text-[15px] leading-normal tracking-[1.8px] uppercase max-phone:text-[13px] max-phone:tracking-[1.4px]"

export const introCopy =
  "text-[24px] leading-normal text-ink-muted max-phone:text-[22px]"

export const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-[18px] border border-ink bg-ink px-[22px] py-2.5 text-[20px] text-paper transition-colors duration-160 hover:bg-[#333]"

export const textLink =
  "inline-flex min-h-11 items-center gap-5 text-[21px] hover:underline hover:decoration-brand hover:underline-offset-6"

export const fieldError =
  "mt-2.5 border-l-2 border-ink pl-2.5 text-[18px] text-ink"

// Editorial artwork is shown in monochrome.
export const archivalImage = "filter-[grayscale(100%)_contrast(1.1)]"

export const lensIcon = "aspect-square h-auto shrink-0 object-contain"

// Workspace, status, and error pages share one intro layout.
export const pageIntro =
  "pt-[75px] pb-[90px] max-phone:pt-[50px] max-phone:pb-[65px]"

export const pageTitle =
  "mt-[15px] mb-5 text-[clamp(48px,6vw,84px)] leading-[1.05] tracking-[-1.8px]"

export const pageIntroCopy = `${introCopy} mb-[25px] max-w-[650px] wrap-anywhere`

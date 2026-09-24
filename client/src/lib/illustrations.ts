/** Switch to "original" to restore the archived editorial illustrations. */
export const illustrationStyle: "minimal" | "original" = "minimal"

const directories = {
  minimal: "/images/minimal",
  original: "/images/archive/editorial-v1",
}

export function illustrationPath(
  filename: string,
  style: "minimal" | "original" = illustrationStyle
): string {
  return `${directories[style]}/${filename}`
}

export const BOOTH_YELLOW = "#FFF284";
export const BOOTH_BLUE = "#87DAFF";
export const BOOTH_PURPLE = "#BFB6EE";
export const BOOTH_ORANGE = "#FFAC7E";
export const BOOTH_DARK = "#BABABA";

export const BOOTH_COLORS: Record<string, string> = {
  BOOTH_YELLOW,
  BOOTH_BLUE,
  BOOTH_PURPLE,
  BOOTH_ORANGE,
  BOOTH_DARK,
};

export const BOOTH_FILL = "#ececec";
export const FACILITY_FILL = "#dadada";

export const HIGHLIGHT = "#00ff00";
export const HIGHLIGHT_FILL = "rgba(0,255,0,0.18)";

export const FAVORITE = "#ff1a1a";
export const FAVORITE_FILL = "rgba(255,26,26,0.16)";

export const ARROW = "#5a5a5a";

export const TOILET_FILL = "#eef3f6";
export const TOILET_STROKE = "#5a5a5a";
export const TOILET_TEXT = "#3f3f3f";

export const INK = "#111";
export const WHITE = "#fff";
export const NAME_MUTED = "#8a8a8a";
export const MORE_MUTED = "#888";
export const ON_DARK = "rgba(255,255,255,0.72)";

export function isDark(c?: string): boolean {
  if (!c) return false;
  const v = c.trim().toLowerCase();
  if (v === "black") return true;
  let hex = v.startsWith("#") ? v.slice(1) : v;
  if (hex.length === 3) hex = hex.split("").map((x) => x + x).join("");
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

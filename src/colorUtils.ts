export function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace('#', '');
    return {
        r: parseInt(clean.substring(0, 2), 16),
        g: parseInt(clean.substring(2, 4), 16),
        b: parseInt(clean.substring(4, 6), 16),
    };
}

export function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function brighten(hex: string, percent: number): string {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHex(
        Math.round(Math.min(255, r * (1 + percent / 100))),
        Math.round(Math.min(255, g * (1 + percent / 100))),
        Math.round(Math.min(255, b * (1 + percent / 100)))
    );
}

export function hexToRgba(hex: string, alpha: number): string {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function isDark(hex: string): boolean {
    const { r, g, b } = hexToRgb(hex);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
}
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

export const fontSans = GeistSans;
export const fontMono = GeistMono;

/** Apply on <html> to expose --font-geist-sans and --font-geist-mono. */
export const fontVariables = `${GeistSans.variable} ${GeistMono.variable}`;

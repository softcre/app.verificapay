// Sin "use client": el layout (server) necesita leer estos valores como strings.

export const THEME_STORAGE_KEY = "vp-theme";

/**
 * Se inyecta en <head> antes de pintar para que la página no parpadee en claro
 * cuando el usuario eligió oscuro. Tiene que coincidir con applyTheme() de
 * lib/theme.ts.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

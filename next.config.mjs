/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // VS Code Ports (Dev Tunnels) reenvía todo con x-forwarded-host apuntando
      // al túnel, incluso el tráfico que entra por localhost. Hay que permitir
      // ambos orígenes: el navegador accediendo por localhost, y el dominio del
      // túnel cuando se accede directo por esa URL.
      allowedOrigins: ["localhost:3000", "**.devtunnels.ms"],
    },
  },
  async redirects() {
    // La vista de pagos vivía en /dashboard; se mantiene el redirect para
    // links y marcadores viejos.
    return [{ source: "/dashboard", destination: "/pagos", permanent: true }];
  },
};

export default nextConfig;

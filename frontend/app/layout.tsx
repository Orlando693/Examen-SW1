import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './theme';

export const metadata: Metadata = {
  title: 'Examen SW1 CASE',
  description: 'Base ejecutable de la herramienta CASE principal',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}

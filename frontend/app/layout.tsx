import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
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
            <GlobalStyles styles={{ html: { width: '100%', height: '100%', overflow: 'hidden' }, body: { width: '100%', height: '100%', overflow: 'hidden' } }} />
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}

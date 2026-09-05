'use client';

import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#f5f7fb',
      paper: '#ffffff',
    },
    primary: {
      main: '#0f4c81',
    },
  },
  shape: {
    borderRadius: 10,
  },
});

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { seedDarkDefault } from '@/lib/theme';
import App from './App.tsx';

seedDarkDefault();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import VentanaLuciernaga from './VentanaLuciernaga';

createRoot(document.getElementById('root')).render(<StrictMode><VentanaLuciernaga messages={[]} /></StrictMode>);

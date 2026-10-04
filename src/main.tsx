import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import './styles/tokens.css';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Taskflow root element is missing');
createRoot(root).render(<StrictMode><App /></StrictMode>);

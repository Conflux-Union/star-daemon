import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';

// R3F 9.7's delayed unmount cleanup destroys the reused WebGL context under StrictMode.
createRoot(document.getElementById('root')!).render(<App />);

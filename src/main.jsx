import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSparkComponents } from 'genesys-spark';
import App from './App.jsx';
import './styles.css';

async function bootstrap() {
  await registerSparkComponents();

  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();

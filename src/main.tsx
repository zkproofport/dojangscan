import React from 'react';
import { createRoot } from 'react-dom/client';
import ScanApp from '../components/scan-app';
import '../app/globals.css';
import '../app/design.css';
import '../components/backend-explorer.css';
import '../components/product-experience.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><ScanApp/></React.StrictMode>);

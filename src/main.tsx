import React from 'react';
import { createRoot } from 'react-dom/client';
import ScanApp from '../components/scan-app';
import '../app/globals.css';
import '../app/design.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><ScanApp/></React.StrictMode>);

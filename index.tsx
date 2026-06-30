import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { StyledEngineProvider } from '@mui/material/styles';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './firebase/AuthContext';

ReactDOM.createRoot(document.querySelector("#root")!).render(
    <React.StrictMode>
        <StyledEngineProvider injectFirst>
            <BrowserRouter>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </BrowserRouter>
        </StyledEngineProvider>
    </React.StrictMode>
);
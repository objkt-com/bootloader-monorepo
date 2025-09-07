import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import React from 'react';
import { tezosService } from './services/tezos.js';
import { CONFIG } from './config.js';
import WalletConnection from './components/WalletConnection.jsx';
import Home from './components/Home.jsx';
import Create from './components/Create.jsx';
import GeneratorDetail from './components/GeneratorDetail.jsx';
import Profile from './components/Profile.jsx';
import Help from './components/Help.jsx';
import ThumbnailRenderer from './components/ThumbnailRenderer.jsx';
import GeneratorThumbnailRenderer from './components/GeneratorThumbnailRenderer.jsx';

// Theme Context
const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Check localStorage for saved theme, default to 'light'
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'light';
  });

  useEffect(() => {
    // Apply theme to document root
    document.documentElement.setAttribute('data-theme', theme);
    // Save theme to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function NetworkBanner() {
  const currentNetwork = CONFIG.network;
  
  if (currentNetwork === 'mainnet') {
    return null;
  }
  
  return (
    <div className="network-banner">
      <div className="network-banner-content">
        {currentNetwork}
      </div>
    </div>
  );
}

// Add CSS custom property to body based on network
function NetworkStyleProvider({ children }) {
  const currentNetwork = CONFIG.network;
  
  React.useEffect(() => {
    if (currentNetwork === 'mainnet') {
      document.documentElement.style.setProperty('--network-banner-height', '0px');
      document.documentElement.style.setProperty('--header-top', '0px');
      document.documentElement.style.setProperty('--main-content-padding-top', '80px'); // Header height only
    } else {
      document.documentElement.style.setProperty('--network-banner-height', '16px');
      document.documentElement.style.setProperty('--header-top', '16px');
      document.documentElement.style.setProperty('--main-content-padding-top', '96px'); // Header height + banner height
    }
  }, [currentNetwork]);
  
  return children;
}

function Navigation() {
  const location = useLocation();
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    // Check wallet connection status
    const checkConnection = () => {
      setIsConnected(tezosService.isConnected);
    };
    
    checkConnection();
    
    // Listen for wallet connection changes
    const interval = setInterval(checkConnection, 1000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <>
      <NetworkBanner />
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <Link to="/">bootloader:</Link>
          </div>
          
          <nav className="nav">
            <Link 
              to="/create" 
              className={location.pathname === '/create' ? 'active' : ''}
            >
              + create
            </Link>
          </nav>
          
          <WalletConnection />
        </div>
      </header>
    </>
  );
}

function Footer() {
  const { theme, toggleTheme } = useTheme();
  
  const currentNetwork = CONFIG.network;
  const otherNetwork = currentNetwork === 'mainnet' ? 'ghostnet' : 'mainnet';
  const otherNetworkUrl = currentNetwork === 'mainnet' 
    ? 'https://ghostnet.bootloader.art' 
    : 'https://bootloader.art';
  
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-links">
          <Link to="/help">Help</Link>
          <a href="https://github.com/objkt-com/bootloader-monorepo" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <button 
            className="theme-toggle" 
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? 'dark' : 'light'}
          </button>
        </div>
        
        <div className="network-switch">
          <span className="current-network">[{currentNetwork}] </span>
          <span className="network-separator"> - </span>
          <a 
            href={otherNetworkUrl} 
            className="network-link"
            title={`Switch to ${otherNetwork}`}
          >
            switch to {otherNetwork}
          </a>
        </div>
        
        <div className="footer-info">
          powered by <a href="https://objkt.com" target="_blank" rel="noopener noreferrer">objkt</a> and <a href="https://tzkt.io" target="_blank" rel="noopener noreferrer">tzkt</a>
        </div>
      </div>
    </footer>
  );
}

function App() {
  return (
    <ThemeProvider>
      <NetworkStyleProvider>
        <Router>
          <Routes>
            {/* Thumbnail routes without navigation/footer */}
            <Route path="/thumbnail/:tokenId" element={<ThumbnailRenderer />} />
            <Route path="/generator-thumbnail/:generatorId" element={<GeneratorThumbnailRenderer />} />
            
            {/* All other routes with navigation/footer */}
            <Route path="/*" element={
              <>
                <Navigation />
                <main className="main-content">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/create" element={<Create />} />
                    <Route path="/generator/:id" element={<GeneratorDetail />} />
                    <Route path="/profile/:address" element={<Profile />} />
                    <Route path="/help" element={<Help />} />
                  </Routes>
                </main>
                <Footer />
              </>
            } />
          </Routes>
        </Router>
      </NetworkStyleProvider>
    </ThemeProvider>
  );
}

export default App;

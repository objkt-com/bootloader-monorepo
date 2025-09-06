import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { tezosService } from './services/tezos.js';
import WalletConnection from './components/WalletConnection.jsx';
import Home from './components/Home.jsx';
import Create from './components/Create.jsx';
import GeneratorDetail from './components/GeneratorDetail.jsx';
import Profile from './components/Profile.jsx';
import Help from './components/Help.jsx';
import ThumbnailRenderer from './components/ThumbnailRenderer.jsx';

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
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <Link to="/">svgKT</Link>
        </div>
        
        <nav className="nav">
          {isConnected && (
            <Link 
              to="/create" 
              className={location.pathname === '/create' ? 'active' : ''}
            >
              + create
            </Link>
          )}
        </nav>
        
        <WalletConnection />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-links">
          <Link to="/help">Help</Link>
          <a href="https://github.com/tsmcalister/svjkt-monorepo" target="_blank" rel="noopener noreferrer">
            GitHub
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
  // Get the base path for GitHub Pages deployment
  const basename = import.meta.env.PROD ? '/svgkt-monorepo' : '';
  
  return (
    <Router basename={basename}>
      <Routes>
        {/* Thumbnail route without navigation/footer */}
        <Route path="/thumbnail/:tokenId" element={<ThumbnailRenderer />} />
        
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
  );
}

export default App;

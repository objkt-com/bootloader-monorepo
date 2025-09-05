import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import WalletConnection from './components/WalletConnection.jsx';
import Home from './components/Home.jsx';
import Create from './components/Create.jsx';
import GeneratorDetail from './components/GeneratorDetail.jsx';

function Navigation() {
  const location = useLocation();
  
  return (
    <header className="header">
      <div className="logo">
        <Link to="/">SVJKT</Link>
      </div>
      
      <nav className="nav">
        <Link 
          to="/" 
          className={location.pathname === '/' ? 'active' : ''}
        >
          explore
        </Link>
        <Link 
          to="/create" 
          className={location.pathname === '/create' ? 'active' : ''}
        >
          create
        </Link>
      </nav>
      
      <WalletConnection />
    </header>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <Navigation />
        
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<Create />} />
            <Route path="/generator/:id" element={<GeneratorDetail />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

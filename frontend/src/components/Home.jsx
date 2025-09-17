import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { tezosService } from '../services/tezos.js';
import { getGeneratorThumbnailUrl } from '../utils/thumbnail.js';
import { getUserDisplayInfo } from '../utils/userDisplay.js';
import SmartThumbnail from './SmartThumbnail.jsx';
import SearchFilters from './SearchFilters.jsx';
import { useMetaTags, generateMetaTags } from '../hooks/useMetaTags.js';

export default function Home() {
  const [allGenerators, setAllGenerators] = useState([]);
  const [filteredGenerators, setFilteredGenerators] = useState([]);
  const [displayedGenerators, setDisplayedGenerators] = useState([]);
  const [authorDisplayInfo, setAuthorDisplayInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, forceUpdate] = useState(0);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    sort: 'newest'
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadGenerators();
  }, []);

  // Set meta tags for home page
  const metaTags = generateMetaTags.home();
  useMetaTags(metaTags);

  // Timer to update countdowns every second
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Apply filters and search whenever they change
  useEffect(() => {
    applyFiltersAndSearch();
  }, [allGenerators, searchTerm, filters]);

  // Update displayed generators when filtered generators or pagination changes
  useEffect(() => {
    updateDisplayedGenerators();
  }, [filteredGenerators, currentPage, itemsPerPage]);

  const loadGenerators = async () => {
    try {
      setLoading(true);
      setError(null);
      const generatorsList = await tezosService.getGenerators();
      setAllGenerators(generatorsList);
      
      // Load author display info for all unique authors
      const uniqueAuthors = [...new Set(generatorsList.map(g => g.author))];
      loadAuthorDisplayInfo(uniqueAuthors);
    } catch (err) {
      console.error('Failed to load generators:', err);
      setError('Failed to load generators');
    } finally {
      setLoading(false);
    }
  };

  const loadAuthorDisplayInfo = async (authors) => {
    const displayInfoPromises = authors.map(async (author) => {
      try {
        const displayInfo = await getUserDisplayInfo(author);
        return { author, displayInfo };
      } catch (err) {
        console.error(`Failed to load display info for ${author}:`, err);
        return { author, displayInfo: { displayName: '', profile: null } };
      }
    });

    const results = await Promise.all(displayInfoPromises);
    const displayInfoMap = {};
    results.forEach(({ author, displayInfo }) => {
      displayInfoMap[author] = displayInfo;
    });
    
    setAuthorDisplayInfo(displayInfoMap);
  };

  const getAuthorDisplayName = (author) => {
    const displayInfo = authorDisplayInfo[author];
    if (displayInfo?.displayName) {
      return displayInfo.displayName;
    }
    // Fallback to shortened address
    return `${author.slice(0, 6)}...${author.slice(-4)}`;
  };

  // Filter and search logic
  const applyFiltersAndSearch = useCallback(() => {
    let filtered = [...allGenerators];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(generator => {
        const name = (generator.name || '').toLowerCase();
        const authorName = getAuthorDisplayName(generator.author).toLowerCase();
        return name.includes(searchLower) || authorName.includes(searchLower);
      });
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(generator => {
        const status = getGeneratorStatus(generator);
        switch (filters.status) {
          case 'active':
            return status.type === 'active';
          case 'scheduled':
            return status.type === 'scheduled';
          case 'sold-out':
            return status.type === 'finished';
          default:
            return true;
        }
      });
    }


    // Apply sorting
    filtered.sort((a, b) => {
      switch (filters.sort) {
        case 'oldest':
          return a.id - b.id;
        case 'most-minted':
          return (b.nTokens || 0) - (a.nTokens || 0);
        case 'newest':
        default:
          return b.id - a.id;
      }
    });

    setFilteredGenerators(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [allGenerators, searchTerm, filters, getAuthorDisplayName]);

  // Pagination logic
  const updateDisplayedGenerators = useCallback(() => {
    const startIndex = 0;
    const endIndex = currentPage * itemsPerPage;
    const displayed = filteredGenerators.slice(startIndex, endIndex);
    
    setDisplayedGenerators(displayed);
    setHasMore(endIndex < filteredGenerators.length);
  }, [filteredGenerators, currentPage, itemsPerPage]);

  // Handler functions for SearchFilters component
  const handleSearchChange = useCallback((term) => {
    setSearchTerm(term);
  }, []);

  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const handleSortChange = useCallback((sortValue) => {
    setFilters(prev => ({ ...prev, sort: sortValue }));
  }, []);

  const handleLoadMore = () => {
    setCurrentPage(prev => prev + 1);
  };

  // Function to determine generator status based on real contract data
  const getGeneratorStatus = (generator) => {
    if (!generator.sale) {
      // No sale configured - generator is just created
      return {
        type: 'created',
        minted: generator.nTokens || 0,
        total: 0,
        progress: 100
      };
    }

    const sale = generator.sale;
    const minted = generator.nTokens || 0;
    const total = sale.editions || 0;
    const progress = total > 0 ? Math.round((minted / total) * 100) : 0;
    const priceInTez = sale.price ? (sale.price / 1000000).toFixed(2) : '0';

    // Check if sale is paused
    if (sale.paused) {
      return {
        type: 'paused',
        minted,
        total,
        price: `${priceInTez} XTZ`,
        progress
      };
    }

    // Check if sold out
    if (minted >= total) {
      return {
        type: 'finished',
        minted,
        total,
        price: `${priceInTez} XTZ`,
        progress: 100
      };
    }

    // Check if scheduled for future
    if (sale.start_time) {
      const startTime = new Date(sale.start_time);
      const now = new Date();
      
      if (now < startTime) {
        const timeDiff = startTime - now;
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
        
        let countdown = '';
        if (days > 0) {
          countdown += `${days}d `;
          if (hours > 0) countdown += `${hours}h `;
          if (minutes > 0) countdown += `${minutes}m`;
        } else if (hours > 0) {
          countdown += `${hours}h `;
          if (minutes > 0) countdown += `${minutes}m `;
          countdown += `${seconds}s`;
        } else if (minutes > 0) {
          countdown += `${minutes}m `;
          countdown += `${seconds}s`;
        } else {
          countdown += `${seconds}s`;
        }
        
        return {
          type: 'scheduled',
          minted,
          total,
          countdown: countdown.trim() || '< 1s',
          progress: 0
        };
      }
    }

    // Sale is active
    return {
      type: 'active',
      minted,
      total,
      price: `${priceInTez} XTZ`,
      progress
    };
  };

  const renderGeneratorStatus = (generator) => {
    const status = getGeneratorStatus(generator);
    
    return (
      <>
        <div className="generator-card-status">
          {status.type === 'scheduled' ? (
            <>
              <span className="generator-card-editions">{status.minted} / {status.total}</span>
              <span className="generator-card-countdown">{status.countdown}</span>
            </>
          ) : status.type === 'created' ? (
            <span className="generator-card-editions">(-)</span>
          ) : status.type === 'paused' ? (
            <>
              <span className="generator-card-editions">{status.minted} / {status.total} minted</span>
              <span className="generator-card-price">PAUSED</span>
            </>
          ) : (
            <>
              <span className="generator-card-editions">{status.minted} / {status.total} minted</span>
              <span className="generator-card-price">{status.price}</span>
            </>
          )}
        </div>
        <div className="progress-bar">
          <div 
            className={`progress-fill ${status.type}`}
            style={{ width: `${status.progress}%` }}
          ></div>
        </div>
      </>
    );
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading generators...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">{error}</div>
        <button onClick={loadGenerators}>retry</button>
      </div>
    );
  }

  return (
    <div className="explore-container">
      <SearchFilters
        onSearchChange={handleSearchChange}
        onFiltersChange={handleFiltersChange}
        onSortChange={handleSortChange}
        totalCount={filteredGenerators.length}
        currentCount={displayedGenerators.length}
        loading={loading}
      />

      {allGenerators.length === 0 && !loading ? (
        <div className="empty-state">
          <p>No generators found.</p>
        </div>
      ) : filteredGenerators.length === 0 && !loading ? (
        <div className="empty-state">
          <p>No generators match your search criteria.</p>
          <p>Try adjusting your filters or search terms.</p>
        </div>
      ) : (
        <>
          <div className="generators-grid">
            {displayedGenerators.map((generator) => (
              <Link 
                key={generator.id} 
                to={`/generator/${generator.id}`}
                className="generator-card"
              >
                <div className="generator-preview-container">
                  <SmartThumbnail
                    src={getGeneratorThumbnailUrl(generator.id, generator.version)}
                    width="500"
                    height="500"
                    alt={generator.name || `Generator #${generator.id}`}
                    maxRetries={8}
                    retryDelay={3000}
                  />
                </div>
                <div className="generator-card-info">
                  <div className="generator-card-title">
                    {generator.name || `Generator #${generator.id}`}
                  </div>
                  <div className="generator-card-author">
                    by {getAuthorDisplayName(generator.author)}
                  </div>
                  {renderGeneratorStatus(generator)}
                </div>
              </Link>
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="pagination-info">
              <button 
                onClick={handleLoadMore}
                className="load-more-button"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

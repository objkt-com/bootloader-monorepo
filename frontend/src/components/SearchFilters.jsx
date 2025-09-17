import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import './SearchFilters.css';

export default function SearchFilters({ 
  onSearchChange, 
  onFiltersChange, 
  onSortChange,
  totalCount = 0,
  currentCount = 0,
  loading = false 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [sortValue, setSortValue] = useState('newest');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, onSearchChange]);

  // Notify parent of filter changes
  useEffect(() => {
    onFiltersChange({ status: activeStatus });
  }, [activeStatus, onFiltersChange]);

  // Notify parent of sort changes
  useEffect(() => {
    onSortChange(sortValue);
  }, [sortValue, onSortChange]);

  const statusTabs = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active Sales' },
    { key: 'scheduled', label: 'Starting Soon' },
    { key: 'sold-out', label: 'Sold Out' }
  ];

  return (
    <div className="search-filters">
      {/* Status Filter - Desktop: Tabs, Mobile: Dropdown */}
      <div className="status-filter-container">
        {/* Desktop Tabs */}
        <div className="status-tabs desktop-only">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key)}
              className={`status-tab ${activeStatus === tab.key ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Mobile Dropdown */}
        <div className="status-dropdown mobile-only">
          <select
            value={activeStatus}
            onChange={(e) => setActiveStatus(e.target.value)}
            className="status-select"
          >
            {statusTabs.map((tab) => (
              <option key={tab.key} value={tab.key}>
                {tab.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <div className="search-input-container">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search generators and artists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="clear-search-btn"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        
        {/* Sort Dropdown */}
        <div className="sort-container">
          <select
            value={sortValue}
            onChange={(e) => setSortValue(e.target.value)}
            className="sort-select"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="most-minted">Most Minted</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="results-info">
        {loading ? (
          <span className="results-loading">Loading...</span>
        ) : (
          <span className="results-count">
            {currentCount === totalCount 
              ? `${totalCount} generator${totalCount !== 1 ? 's' : ''}`
              : `Showing ${currentCount} of ${totalCount} generators`
            }
          </span>
        )}
      </div>
    </div>
  );
}

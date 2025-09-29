import React, { useState, useEffect, useRef } from 'react';
import { objktService } from '../services/objkt.js';
import { getContractAddress } from '../config.js';
import { getDisplayName, formatAddress } from '../utils/userDisplay.js';
import { Link } from 'react-router-dom';
import SmartThumbnail from './SmartThumbnail.jsx';
import './Activity.css';

const Activity = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const lastEventTimestamp = useRef(null);

  // Load initial activity data
  const loadInitialActivity = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const activityData = await objktService.getBootloaderActivity(50);
      // Mark initial items for subtle animation
      const initialItems = activityData.map((item, index) => ({ 
        ...item, 
        isInitial: true,
        initialIndex: index // Track original index for staggered animation
      }));
      setEvents(initialItems);
      
      // Store the timestamp of the most recent event for polling
      if (activityData.length > 0) {
        lastEventTimestamp.current = activityData[0].timestamp;
      }
      
      // Remove initial animation class after animation completes
      setTimeout(() => {
        setEvents(currentEvents => 
          currentEvents.map(event => ({ ...event, isInitial: false }))
        );
      }, 1000); // Allow time for all staggered animations to complete
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to load activity:', err);
      setError('Failed to load activity data');
      setLoading(false);
    }
  };

  // Poll for new activity
  const pollForNewActivity = async () => {
    if (!lastEventTimestamp.current) return;

    try {
      const newEvents = await objktService.getBootloaderActivity(10, lastEventTimestamp.current);
      
      if (newEvents.length > 0) {
        setEvents(prevEvents => {
          // Merge new events with existing ones, avoiding duplicates
          const existingIds = new Set(prevEvents.map(e => e.id));
          const uniqueNewEvents = newEvents.filter(e => !existingIds.has(e.id));
          
          if (uniqueNewEvents.length > 0) {
            // Update the last timestamp
            lastEventTimestamp.current = uniqueNewEvents[0].timestamp;
            
            // Add new events to the beginning and limit total to 100
            // Mark them as new and set a timeout to remove the new flag
            const newEventsWithFlag = uniqueNewEvents.map(e => ({ ...e, isNew: true }));
            
            
            // Clean existing events of any animation classes to prevent re-animation
            const cleanedPrevEvents = prevEvents.map(event => ({
              ...event,
              isInitial: false,
              isNew: false
            }));
            
            return [...newEventsWithFlag, ...cleanedPrevEvents].slice(0, 100);
          }
          
          return prevEvents;
        });
      }
    } catch (err) {
      console.error('Failed to poll for new activity:', err);
      // Don't show error for polling failures, just log them
    }
  };

  // Initialize and set up polling
  useEffect(() => {
    loadInitialActivity();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Set up continuous polling for live updates
  useEffect(() => {
    intervalRef.current = setInterval(pollForNewActivity, 5000); // Poll every 5 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const eventTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - eventTime) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m ago`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    } else {
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    }
  };

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'mint':
        return '✨';
      case 'sale':
        return '💰';
      default:
        return '📝';
    }
  };

  return (
    <div className="activity-container">
      <div className="activity-header">
        <div className="activity-title-section">
          <h1>Activity</h1>
          <p className="activity-subtitle">Recent bootloader mints and sales</p>
        </div>
        
        <div className="activity-live-indicator">
          <span className="live-dot"></span>
          <span className="live-text">Live</span>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="empty-state">
          <p>No recent activity found.</p>
        </div>
      ) : (
        <div className="activity-feed">
          {events.map((event, index) => (
            <div 
              key={`${event.id}-${index}`} 
              className={`activity-item ${event.isNew ? 'new' : ''} ${event.isInitial ? 'initial' : ''}`}
              style={event.isInitial && event.initialIndex !== undefined ? 
                { animationDelay: `${event.initialIndex * 20}ms` } : 
                {}
              }
            >
              {event.token_thumbnail_uri && (
                <Link to={`/token/${event.token_id}`} className="activity-thumbnail">
                  <SmartThumbnail 
                    src={event.token_thumbnail_uri} 
                    alt={event.token_name || `Token #${event.token_id}`}
                    width="60"
                    height="60"
                    style={{ borderRadius: '4px' }}
                  />
                </Link>
              )}
              
              <div className="activity-content">
                <div className="activity-main">
                  <div className="activity-token-info">
                    <Link to={`/token/${event.token_id}`} className="activity-token-link">
                      {event.token_name || `#${event.token_id}`}
                    </Link>
                    {event.amount > 1 && (
                      <span className="activity-editions"> × {event.amount}</span>
                    )}
                  </div>
                  
                  {event.price_xtz && (
                    <div className="activity-price">
                      {(event.price_xtz / 1000000).toFixed(2)} ꜩ
                    </div>
                  )}
                </div>
                
                <div className="activity-meta">
                  <div className="activity-action-user">
                    <span className="activity-icon">{getEventIcon(event.event_type)}</span>
                    {event.event_type === 'mint' ? (
                      <span>
                        Minted by{' '}
                        <Link 
                          to={`/profile/${event.recipient_address || event.creator_address}`} 
                          className="activity-user-link"
                        >
                          {(event.recipient_address ? 
                            (event.recipient_alias || formatAddress(event.recipient_address)) : 
                            (event.creator_alias || formatAddress(event.creator_address))
                          )}
                        </Link>
                      </span>
                    ) : (
                      <span>
                        Sold by{' '}
                        <Link to={`/profile/${event.creator_address}`} className="activity-user-link">
                          {event.creator_alias || formatAddress(event.creator_address)}
                        </Link>
                        {event.recipient_address && (
                          <>
                            {' '}to{' '}
                            <Link to={`/profile/${event.recipient_address}`} className="activity-user-link">
                              {event.recipient_alias || formatAddress(event.recipient_address)}
                            </Link>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  
                  <div className="activity-time">
                    {formatTimeAgo(event.timestamp)}
                  </div>
                </div>
              </div>

              {event.ophash && (
                <a 
                  href={`https://tzkt.io/${event.ophash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="activity-tzkt-link"
                  title="View on TzKT"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15,3 21,3 21,9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Activity;

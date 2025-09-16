import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import UserAvatar from './UserAvatar.jsx';
import './UserProfileDropdown.css';

const UserProfileDropdown = ({ userAddress, onDisconnect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close dropdown when pressing Escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleDisconnectClick = () => {
    setIsOpen(false);
    onDisconnect();
  };

  const handleProfileClick = () => {
    setIsOpen(false);
  };

  return (
    <div className="user-profile-dropdown" ref={dropdownRef}>
      <button 
        className="user-profile-trigger"
        onClick={toggleDropdown}
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        <UserAvatar address={userAddress} size={32} />
      </button>

      {isOpen && (
        <div className="user-profile-menu">
          <div className="user-profile-menu-content">
            <Link 
              to={`/profile/${userAddress}`} 
              className="user-profile-menu-item"
              onClick={handleProfileClick}
            >
              Profile
            </Link>
            
            <button 
              className="user-profile-menu-item disconnect-item"
              onClick={handleDisconnectClick}
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileDropdown;

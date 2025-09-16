import React, { useState, useEffect } from 'react';
import PixelAvatar from './PixelAvatar.jsx';
import { fetchUserProfile } from '../utils/userDisplay.js';

const UserAvatar = ({ address, size = 32, className = '' }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        setLoading(true);
        const userProfile = await fetchUserProfile(address);
        setProfile(userProfile);
      } catch (error) {
        console.error('Failed to load user profile:', error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [address]);

  // If loading, show a placeholder
  if (loading) {
    return (
      <div 
        className={`user-avatar-placeholder ${className}`}
        style={{ 
          width: size + 'px', 
          height: size + 'px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-gray-light)',
          border: '1px solid var(--color-gray-medium)'
        }}
      />
    );
  }

  // Try to get user logo from objkt API
  const hasLogo = profile?.logo && profile.logo.trim() && !imageError;

  if (hasLogo) {
    return (
      <img
        src={profile.logo}
        alt={`${address} avatar`}
        className={`user-avatar-image ${className}`}
        style={{
          width: size + 'px',
          height: size + 'px',
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid var(--color-black)'
        }}
        onError={() => setImageError(true)}
      />
    );
  }

  // Fallback to PixelAvatar
  return (
    <PixelAvatar 
      address={address} 
      size={size} 
      className={`user-avatar-pixel ${className}`}
    />
  );
};

export default UserAvatar;

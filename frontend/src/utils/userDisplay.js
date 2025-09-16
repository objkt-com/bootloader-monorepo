/**
 * Utility functions for displaying user information with proper fallbacks
 */

import { getNetworkConfig } from '../config.js';

// Cache for user profiles to avoid repeated API calls
const userProfileCache = new Map();

/**
 * Gets the correct objkt API URL based on network configuration
 * @returns {string} The objkt GraphQL API URL
 */
function getObjktApiUrl() {
  const networkConfig = getNetworkConfig();
  // Use ghostnet API for ghostnet, mainnet API for mainnet
  return networkConfig.tzktApi.includes('ghostnet') 
    ? 'https://data.ghostnet.objkt.com/v3/graphql'
    : 'https://data.objkt.com/v3/graphql';
}

/**
 * Fetches user profile from objkt API
 * @param {string} address - The user's Tezos address
 * @returns {Promise<Object|null>} User profile object or null if not found
 */
export async function fetchUserProfile(address) {
  if (!address) return null;
  
  // Check cache first
  if (userProfileCache.has(address)) {
    return userProfileCache.get(address);
  }

  try {
    const query = `
      query GetHolder($address: String!) {
        holder(where: {address: {_eq: $address}}) {
          address
          alias
          description
          twitter
          tzdomain
          logo
        }
      }
    `;
    
    const response = await fetch(getObjktApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { address }
      })
    });
    
    const data = await response.json();
    const holder = data.data?.holder;
    
    // Handle case where holder is an array (GraphQL returns array) or null/undefined
    const profile = (holder && Array.isArray(holder) && holder.length > 0) 
      ? holder[0] 
      : null;
    
    // Cache the result (even if null)
    userProfileCache.set(address, profile);
    
    return profile;
  } catch (err) {
    console.error('Failed to fetch user profile:', err);
    userProfileCache.set(address, null);
    return null;
  }
}

/**
 * Formats an address to a shortened version
 * @param {string} address - The full address
 * @returns {string} Shortened address (first 6 + last 4 characters)
 */
export function formatAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Gets the best display name for a user based on priority:
 * 1. alias
 * 2. tzdomain
 * 3. address shortened
 * @param {Object} profile - User profile object from objkt API
 * @param {string} address - Fallback address if profile is null
 * @returns {string} Best display name
 */
export function getDisplayName(profile, address) {
  if (!profile && !address) return '';
  
  if (profile) {
    // Priority 1: alias
    if (profile.alias && profile.alias.trim()) {
      return profile.alias.trim();
    }
    
    // Priority 2: tzdomain
    if (profile.tzdomain && profile.tzdomain.trim()) {
      return profile.tzdomain.trim();
    }
  }
  
  // Priority 3: shortened address
  return formatAddress(address || profile?.address);
}

/**
 * Hook-like function that fetches and returns user display information
 * @param {string} address - The user's address
 * @returns {Promise<Object>} Object with displayName, profile, and isLoading
 */
export async function getUserDisplayInfo(address) {
  if (!address) {
    return {
      displayName: '',
      profile: null,
      isLoading: false
    };
  }

  try {
    const profile = await fetchUserProfile(address);
    const displayName = getDisplayName(profile, address);
    
    return {
      displayName,
      profile,
      isLoading: false
    };
  } catch (err) {
    console.error('Error getting user display info:', err);
    return {
      displayName: formatAddress(address),
      profile: null,
      isLoading: false
    };
  }
}

/**
 * Clears the user profile cache (useful for testing or memory management)
 */
export function clearUserProfileCache() {
  userProfileCache.clear();
}

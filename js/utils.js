/**
 * Utility module - Contains helper functions
 * This module provides utility functions for string manipulation,
 * date formatting, and mathematical calculations.
 */

/**
 * Updates the cache status indicator
 * @param {boolean} fromCache - If data comes from cache
 * @param {string} timestamp - Cache timestamp (if available)
 */
function updateCacheIndicator(fromCache, timestamp = null) {
    const indicator = document.getElementById('cache-indicator');
    if (!indicator) return;
    
    if (fromCache) {
        let timeAgoText = '';
        if (timestamp) {
            const cacheDate = new Date(timestamp);
            const now = new Date();
            const diffInHours = Math.floor((now - cacheDate) / (1000 * 60 * 60));
            
            if (diffInHours < 1) {
                timeAgoText = 'a few minutes ago';
            } else if (diffInHours < 24) {
                timeAgoText = `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
            } else {
                const diffInDays = Math.floor(diffInHours / 24);
                timeAgoText = `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
            }
        }
        
        indicator.innerHTML = `
            <i class="fas fa-database"></i>
            <span>Cached data ${timeAgoText}</span>
        `;
        indicator.classList.add('is-cached');
    } else {
        indicator.innerHTML = `
            <i class="fas fa-sync-alt"></i>
            <span>Up-to-date data</span>
        `;
        indicator.classList.remove('is-cached');
    }
}

/**
 * Version modifiée de processRepositoryData pour utiliser le nouvel indicateur de cache
 * @param {Object} cachResult - Résultat du cache contenant data et timestamp
 */
async function processRepositoryData(cacheResult) {
    let repositories, timestamp;
    
    // Handle both object format and direct array
    if (cacheResult && cacheResult.data) {
        repositories = cacheResult.data;
        timestamp = cacheResult.timestamp;
        // Update the cache indicator to show we're using cached data
        updateCacheIndicator(true, timestamp);
    } else {
        repositories = cacheResult;
        // Update the cache indicator to show we're using fresh data
        updateCacheIndicator(false);
    }
       
    config.data.repositories = repositories;
    config.data.filteredRepositories = [...repositories];
    
    // Extract tags and authors for filters
    extractAllTags();
    populateAuthorsFilter();
    
    // Configure stars slider
    configureStarsSlider();
    
    updateStatsWithAnimation();
    
    sortRepositories();
    config.data.currentPage = 1;
    renderRepositories();
    
    showLoading(false);
}

/**
 * Modification de la fonction checkCache pour capturer le timestamp
 * @param {string} key - La clé de cache
 * @param {boolean} ignoreExpiry - Si l'expiration doit être ignorée
 * @returns {Object|null} - Les données en cache avec leur timestamp ou null
 */
function checkCache(key, ignoreExpiry = false) {
    try {
        const cachedItem = localStorage.getItem(key);
        if (!cachedItem) return null;
        
        const { data, timestamp } = JSON.parse(cachedItem);
        const now = new Date().getTime();
        
        // Cache expires after 24 hours unless ignoreExpiry is true
        if (!ignoreExpiry && now - timestamp > 24 * 60 * 60 * 1000) {
            return null;
        }
               
        // Return both data and timestamp
        return {
            data,
            timestamp
        };
    } catch (e) {
        return null;
    }
}

/**
 * Saves data to cache
 * @param {string} key - The cache key
 * @param {Array} data - The data to cache
 */
function saveToCache(key, data) {
    try {
        const cacheItem = {
            data,
            timestamp: new Date().getTime()
        };
        localStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (e) {
        console.error('Error saving to cache:', e);
    }
}

/**
 * Formats a repository name for display
 * @param {String} name - The raw repository name
 * @returns {String} - The formatted name
 */
function formatRepoName(name) {
    name = name.replace(/[-_]/g, ' ');
    
    return name.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Formats a date for display
 * @param {String} dateString - ISO format date string
 * @returns {String} - Formatted date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Calculates a progress percentage for a repository
 * @param {Object} repo - The repository data
 * @returns {Number} - Progress percentage (0-100)
 */
function calculateProgress(repo) {
    const updatedRecently = isRecentlyUpdated(repo.updated_at) ? 30 : 0;
    const hasTopics = (repo.topics && repo.topics.length > 0) ? 20 : 0;
    const hasDescription = repo.description ? 20 : 0;
    
    const maxStats = 100;
    const starWeight = 0.5;
    const forkWeight = 0.3;
    const watchWeight = 0.2;
    
    const starScore = Math.min(repo.stargazers_count * 5, maxStats) * starWeight;
    const forkScore = Math.min(repo.forks_count * 10, maxStats) * forkWeight;
    const watchScore = Math.min(repo.watchers_count * 2, maxStats) * watchWeight;
    
    const statsScore = (starScore + forkScore + watchScore) / (maxStats * (starWeight + forkWeight + watchWeight)) * 30;
    
    const totalProgress = updatedRecently + hasTopics + hasDescription + statsScore;
    return Math.round(totalProgress);
}

/**
 * Checks if a repository was updated recently
 * @param {String} dateString - ISO format date string
 * @returns {Boolean} - True if updated within the last 3 months
 */
function isRecentlyUpdated(dateString) {
    const updateDate = new Date(dateString);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    return updateDate > threeMonthsAgo;
}

/**
 * Generates a hash code for a string
 * @param {String} str - The string to hash
 * @returns {Number} - The hash code
 */
function getHashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;  // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

/**
 * Debounces a function call
 * @param {Function} func - The function to debounce
 * @param {Number} wait - Wait time in ms
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Throttles a function call
 * @param {Function} func - The function to throttle
 * @param {Number} limit - Throttle limit in ms
 * @returns {Function} - Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
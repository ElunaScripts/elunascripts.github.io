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
        let ttlText = '';
        
        if (timestamp) {
            // Calculate time since cache was created
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
            
            // Calculate time until cache expires
            const expiryTime = cacheDate.getTime() + cacheConfig.durations[cacheConfig.current];
            const timeToExpiry = expiryTime - now.getTime();
            
            if (timeToExpiry <= 0) {
                ttlText = '(expired)';
            } else {
                const hoursToExpiry = Math.floor(timeToExpiry / (1000 * 60 * 60));
                
                if (hoursToExpiry < 1) {
                    const minutesToExpiry = Math.floor(timeToExpiry / (1000 * 60));
                    ttlText = `(expires in ${minutesToExpiry} min)`;
                } else if (hoursToExpiry < 24) {
                    ttlText = `(expires in ${hoursToExpiry} hr)`;
                } else {
                    const daysToExpiry = Math.floor(hoursToExpiry / 24);
                    ttlText = `(expires in ${daysToExpiry} days)`;
                }
            }
        }
        
        indicator.innerHTML = `
            <div class="cache-info">
                <i class="fas fa-database"></i>
                <span>Cached data ${timeAgoText} ${ttlText}</span>
            </div>
            <button class="cache-refresh-btn" title="Refresh data from GitHub" onclick="refreshData()">
                <i class="fas fa-sync-alt"></i>
            </button>
        `;
        indicator.classList.add('is-cached');
    } else {
        indicator.innerHTML = `
            <div class="cache-info">
                <i class="fas fa-sync-alt"></i>
                <span>Up-to-date data</span>
            </div>
        `;
        indicator.classList.remove('is-cached');
    }
}

/**
 * Force refresh data from the API, bypassing cache
 */
function refreshData() {
    // Show a loading spinner in the refresh button
    const refreshBtn = document.querySelector('.cache-refresh-btn i');
    if (refreshBtn) {
        refreshBtn.classList.add('fa-spin');
    }
    
    // Show info toast
    showInfoToast('Refreshing data from GitHub...');
    
    // Clear the repository cache specifically
    localStorage.removeItem('eluna-repositories');
    
    // Re-fetch the data
    fetchRepositories().then(() => {
        // Stop the spinner when done
        if (refreshBtn) {
            refreshBtn.classList.remove('fa-spin');
        }
        
        // Show success toast
        showSuccessToast('Data refreshed successfully!');
    }).catch(err => {
        console.error('Failed to refresh data:', err);
        // Stop the spinner even if there's an error
        if (refreshBtn) {
            refreshBtn.classList.remove('fa-spin');
        }
        
        // Show error toast
        showErrorToast('Failed to refresh data. Please try again later.');
    });
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
        
        // Use the configured cache duration
        const cacheDuration = cacheConfig.durations[cacheConfig.current];
        
        // Check if cache has expired
        if (!ignoreExpiry && now - timestamp > cacheDuration) {
            console.log(`Cache expired for ${key} (${cacheConfig.current} TTL: ${cacheDuration}ms)`);
            return null;
        }
        
        console.log(`Using cached data for ${key} with ${data.length} items`);
        
        // Return both data and timestamp
        return {
            data,
            timestamp
        };
    } catch (e) {
        console.error('Error reading from cache:', e);
        return null;
    }
}

/**
 * Sets the cache duration
 * @param {string} duration - The duration setting (short, medium, long, veryLong)
 */
function setCacheDuration(duration) {
    if (cacheConfig.durations[duration]) {
        cacheConfig.current = duration;
        // Store the user preference
        localStorage.setItem('cache-duration-preference', duration);
        console.log(`Cache duration set to ${duration}`);
        
        // Update the UI if we currently show cached data
        const indicator = document.getElementById('cache-indicator');
        if (indicator && indicator.classList.contains('is-cached')) {
            // Re-check the cache with the new duration
            const cacheResult = checkCache('eluna-repositories');
            if (cacheResult) {
                updateCacheIndicator(true, cacheResult.timestamp);
            } else {
                // If cache is now invalid with new duration, refresh
                refreshData();
            }
        }
        
        return true;
    }
    return false;
}

/**
 * Initialize cache settings from user's previous preference
 */
function initCacheSettings() {
    const savedPreference = localStorage.getItem('cache-duration-preference');
    if (savedPreference && cacheConfig.durations[savedPreference]) {
        cacheConfig.current = savedPreference;
        console.log(`Using saved cache duration preference: ${savedPreference}`);
    }
    
    createCacheSettingsUI();

    attachCacheSettingsEvents();
}

function attachCacheSettingsEvents() {
    setTimeout(() => {
        const indicator = document.getElementById('cache-indicator');
        
        if (indicator) {
            console.log('Adding click event to cache indicator');
            
            indicator.addEventListener('click', function(e) {
                if (!e.target.closest('.cache-refresh-btn')) {
                    console.log('Opening cache settings dialog');
                    const dialog = document.getElementById('cache-settings-dialog');
                    if (dialog) {
                        dialog.style.display = 'flex';
                    } else {
                        console.error('Cache settings dialog not found');
                        showErrorToast('Could not open settings');
                    }
                }
            });
            
            indicator.style.cursor = 'pointer';
        } else {
            console.error('Cache indicator element not found');
        }
    }, 500);
}

/**
 * Save cache settings and close dialog
 */
function saveCacheSettings() {
    // Save to localStorage
    localStorage.setItem('cache-duration-preference', cacheConfig.current);
    
    // Update UI if needed
    const indicator = document.getElementById('cache-indicator');
    if (indicator && indicator.classList.contains('is-cached')) {
        const cacheResult = checkCache('eluna-repositories');
        if (cacheResult) {
            updateCacheIndicator(true, cacheResult.timestamp);
        }
    }
    
    // Close dialog
    const dialog = document.getElementById('cache-settings-dialog');
    if (dialog) {
        dialog.style.display = 'none';
    }
    
    // Show confirmation - UPDATED
    showSuccessToast('Cache settings saved!');
}

function clearAllCache() {
    // Clear only our app's cache keys
    const appCacheKeys = ['eluna-repositories', 'eluna-repository-icons', 'cache-duration-preference'];
    appCacheKeys.forEach(key => localStorage.removeItem(key));
    
    // Close dialog
    const dialog = document.getElementById('cache-settings-dialog');
    if (dialog) {
        dialog.style.display = 'none';
    }
    
    // Show confirmation - UPDATED
    showSuccessToast('Cache cleared successfully');
    
    // Refresh data
    refreshData();
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

/**
 * Finds an image file in repository contents
 * @param {Array} contents - The repository contents
 * @returns {Object|null} - The image file object or null if not found
 */
function findImageInContents(contents) {
    // Image patterns to look for, in order of preference
    const imagePatterns = [
        'icon.png', 'icon.jpg', 'icon.jpeg', 'icon.webp',
        'logo.png', 'logo.jpg', 'logo.jpeg', 'logo.webp',
        'preview.png', 'preview.jpg', 'preview.jpeg', 'preview.webp',
        'screenshot.png', 'screenshot.jpg', 'screenshot.jpeg', 'screenshot.webp',
        'banner.png', 'banner.jpg', 'banner.jpeg', 'banner.webp',
        'header.png', 'header.jpg', 'header.jpeg', 'header.webp'
    ];
    
    // First try exact matches
    for (const pattern of imagePatterns) {
        const exactMatch = contents.find(file => 
            file.type === 'file' && 
            file.name.toLowerCase() === pattern
        );
        
        if (exactMatch) {
            return exactMatch;
        }
    }
    
    // Then try files that contain these words
    const imageKeywords = ['icon', 'logo', 'preview', 'screenshot', 'banner', 'header'];
    
    for (const keyword of imageKeywords) {
        const matchingFile = contents.find(file => 
            file.type === 'file' && 
            file.name.toLowerCase().includes(keyword) &&
            /\.(png|jpe?g|webp|gif)$/i.test(file.name)
        );
        
        if (matchingFile) {
            return matchingFile;
        }
    }
    
    // Finally, just look for any image file
    return contents.find(file => 
        file.type === 'file' && 
        /\.(png|jpe?g|webp|gif)$/i.test(file.name)
    ) || null;
}

/**
 * Adds an image to a container element
 * @param {string} imageUrl - The URL of the image
 * @param {HTMLElement} container - The container element
 * @param {Object} repo - The repository object
 */
function addImageToContainer(imageUrl, container, repo) {
    // Clear container first
    container.innerHTML = '';
    
    const img = document.createElement('img');
    img.className = 'script-image';
    img.src = imageUrl;
    img.alt = `${repo.name} preview`;
    
    img.onerror = () => {
        // If the image fails to load, generate a background instead
        container.innerHTML = '';
        generateBackground(repo, container);
        
        // Update cache to indicate no valid image
        saveToCache(`repo-icon-${repo.id}`, { notFound: true });
    };
    
    container.appendChild(img);
}

/**
 * Closes the repository details modal
 */
function closeRepositoryModal() {
    const modal = document.getElementById('repository-modal');
    if (!modal) return;
    
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
    console.log('Modal closed'); // Debugging
}

/**
 * Fetches and renders a repository's README file
 * @param {Object} repo - The repository data
 * @param {HTMLElement} container - Container to render README in
 */
async function fetchAndRenderReadme(repo, container) {
    try {
        // Check if marked.js is loaded, if not load it
        if (typeof marked === 'undefined') {
            await loadMarkedJS();
        }
        
        // Check cache first
        const cacheKey = `repo-readme-${repo.id}`;
        const cachedReadme = checkCache(cacheKey);
        
        if (cachedReadme) {
            container.innerHTML = cachedReadme.data.html;
            return;
        }
        
        // Fetch README content
        const readmeUrl = `${repo.url}/readme`;
        const response = await fetch(readmeUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch README: ${response.status}`);
        }
        
        const readmeData = await response.json();
        
        // GitHub returns base64 encoded content
        const decodedContent = atob(readmeData.content);
        
        // Convert Markdown to HTML using marked.js
        const html = marked.parse(decodedContent, {
            breaks: true,
            gfm: true
        });
        
        // Cache the result
        saveToCache(cacheKey, { html });
        
        // Set content
        container.innerHTML = html;
        container.className = 'repository-modal-readme readme-markdown';
        
        // Make relative links absolute
        fixRelativeLinks(container, repo.html_url);
        
    } catch (error) {
        console.error('Error in fetchAndRenderReadme:', error);
        throw error;
    }
}

/**
 * Loads the marked.js library dynamically
 * @returns {Promise} - Promise that resolves when the library is loaded
 */
function loadMarkedJS() {
    return new Promise((resolve, reject) => {
        // Check if it's already loaded
        if (typeof marked !== 'undefined') {
            resolve();
            return;
        }
        
        // Create script element
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js';
        script.crossOrigin = 'anonymous';
        script.referrerPolicy = 'no-referrer';
        
        script.onload = () => {
            // Configure marked with options
            marked.use({
                pedantic: false,
                gfm: true,
                breaks: true,
                sanitize: false,
                smartypants: false,
                xhtml: false
            });
            resolve();
        };
        
        script.onerror = () => {
            reject(new Error('Failed to load marked.js'));
        };
        
        document.head.appendChild(script);
    });
}

/**
 * Converts markdown to HTML
 * This is a simple implementation. In a production app, use a proper Markdown library.
 * @param {string} markdown - The markdown content
 * @returns {string} - The HTML content
 */
function convertMarkdownToHtml(markdown) {
    // Very basic Markdown conversion
    let html = markdown
        // Headers
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
        .replace(/^##### (.*$)/gm, '<h5>$1</h5>')
        .replace(/^###### (.*$)/gm, '<h6>$1</h6>')
        
        // Bold and italic
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        
        // Links
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
        
        // Images
        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">')
        
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        
        // Lists
        .replace(/^\* (.*$)/gm, '<ul><li>$1</li></ul>')
        .replace(/^- (.*$)/gm, '<ul><li>$1</li></ul>')
        .replace(/^\d+\. (.*$)/gm, '<ol><li>$1</li></ol>')
        
        // Blockquotes
        .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
        
        // Horizontal rules
        .replace(/^---$/gm, '<hr>');
    
    // Fix consecutive list items (merge them)
    html = html
        .replace(/<\/ul><ul>/g, '')
        .replace(/<\/ol><ol>/g, '');
    
    // Convert paragraphs (lines that are not already HTML)
    const paragraphs = html.split('\n').map(line => {
        if (line.trim() !== '' && 
            !line.startsWith('<h') && 
            !line.startsWith('<ul') && 
            !line.startsWith('<ol') && 
            !line.startsWith('<blockquote') && 
            !line.startsWith('<pre') && 
            !line.startsWith('<hr')) {
            return `<p>${line}</p>`;
        }
        return line;
    });
    
    return paragraphs.join('\n');
}


/**
 * Repository image loading utilities
 * These functions handle loading repository images and generating fallbacks
 */

/**
 * Attempts to load a repository image from various potential paths
 * Implements a more robust image fetching strategy with fallbacks
 * @param {Object} repo - The repository object
 * @param {HTMLElement} container - The container to place the image in
 */
async function loadRepositoryImage(repo, container) {
    try {
        // Check if we have a cached icon for this repo
        const cachedIcon = checkCache(`repo-icon-${repo.id}`);
        if (cachedIcon) {
            if (cachedIcon.data.url) {
                addImageToContainer(cachedIcon.data.url, container, repo);
                return true;
            } else if (cachedIcon.data.notFound) {
                // We've already determined this repo has no image
                generateBackground(repo, container);
                return false;
            }
        }
        
        // Try to fetch the repository contents to find image files
        const result = await fetchRepositoryContents(repo);
        
        if (result.success && result.imageUrl) {
            // Save to cache
            saveToCache(`repo-icon-${repo.id}`, { url: result.imageUrl });
            addImageToContainer(result.imageUrl, container, repo);
            return true;
        } else {
            // Mark as no image found in cache to avoid future attempts
            saveToCache(`repo-icon-${repo.id}`, { notFound: true });
            generateBackground(repo, container);
            return false;
        }
    } catch (error) {
        console.error('Error loading repository image:', error);
        generateBackground(repo, container);
        return false;
    }
}

/**
 * Fetches the contents of a repository to find potential image files
 * @param {Object} repo - The repository object
 * @returns {Promise<Object>} - Object with success flag and image URL if found
 */
async function fetchRepositoryContents(repo) {
    try {
        // Try to fetch repository contents
        const contentsUrl = `${repo.url}/contents`;
        const response = await fetch(contentsUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch repository contents: ${response.status}`);
        }
        
        const contents = await response.json();
        
        // Look for image files in the root directory
        const imageFile = findImageInContents(contents);
        
        if (imageFile) {
            return {
                success: true,
                imageUrl: imageFile.download_url
            };
        }
        
        // If no image found in root, try to check if there's an 'images', 'img', or 'assets' directory
        const imageDirectories = contents.filter(item => 
            item.type === 'dir' && 
            ['images', 'img', 'assets', 'media', 'screenshots', 'docs'].includes(item.name.toLowerCase())
        );
        
        for (const dir of imageDirectories) {
            const dirContentsResponse = await fetch(dir.url);
            
            if (dirContentsResponse.ok) {
                const dirContents = await dirContentsResponse.json();
                const imageInDir = findImageInContents(dirContents);
                
                if (imageInDir) {
                    return {
                        success: true,
                        imageUrl: imageInDir.download_url
                    };
                }
            }
        }
        
        // No image found anywhere
        return {
            success: false
        };
    } catch (error) {
        console.error('Error fetching repository contents:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Opens the repository details modal with the given repository data
 * @param {Object} repo - The repository data
 */
async function openRepositoryModal(repo) {
    const modal = document.getElementById('repository-modal');
    if (!modal) return;
    
    // Set basic repository information
    document.getElementById('repository-modal-title').textContent = formatRepoName(repo.name);
    document.getElementById('repository-modal-author').textContent = repo.owner.login;
    document.getElementById('repository-modal-author-name').textContent = repo.owner.login;
    document.getElementById('repository-modal-date').textContent = formatDate(repo.created_at);
    
    // Set stats
    document.getElementById('repository-modal-stars').textContent = repo.stargazers_count;
    document.getElementById('repository-modal-forks').textContent = repo.forks_count;
    document.getElementById('repository-modal-issues').textContent = repo.open_issues_count;
    document.getElementById('repository-modal-watchers').textContent = repo.watchers_count;
    
    // Set dates and license
    document.getElementById('repository-modal-created').textContent = formatDate(repo.created_at);
    document.getElementById('repository-modal-updated').textContent = formatDate(repo.updated_at);
    document.getElementById('repository-modal-license').textContent = repo.license ? repo.license.name : 'Not specified';
    
    // Set links
    document.getElementById('repository-modal-download').href = `${repo.html_url}/archive/refs/heads/master.zip`;
    document.getElementById('repository-modal-github').href = repo.html_url;
    
    // Clear previous tags
    const tagsContainer = document.getElementById('repository-modal-tags');
    tagsContainer.innerHTML = '';
    
    // Add tags
    const topics = repo.topics || [];
    if (topics.length > 0) {
        topics.forEach(topic => {
            const tagElement = document.createElement('span');
            tagElement.className = 'repository-modal-tag';
            tagElement.textContent = topic;
            tagsContainer.appendChild(tagElement);
        });
    } else {
        ['Lua', 'Eluna', 'Script'].forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'repository-modal-tag';
            tagElement.textContent = tag;
            tagsContainer.appendChild(tagElement);
        });
    }
    
    // Set banner image or generated background
    const bannerContainer = document.getElementById('repository-modal-banner');
    bannerContainer.innerHTML = '';
    
    try {
        await loadRepositoryImage(repo, bannerContainer);
    } catch (error) {
        console.error('Error loading repository banner:', error);
        generateBackground(repo, bannerContainer);
    }
    
    // Load avatar if available
    const avatarPlaceholder = document.getElementById('repository-modal-avatar-placeholder');
    const avatarImg = document.getElementById('repository-modal-avatar');
    
    if (repo.owner && repo.owner.avatar_url) {
        avatarImg.src = repo.owner.avatar_url;
        avatarImg.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
    } else {
        avatarImg.style.display = 'none';
        avatarPlaceholder.style.display = 'flex';
    }
    
    // Show loading state for README
    const readmeLoading = document.getElementById('repository-modal-readme-loading');
    const readmeContainer = document.getElementById('repository-modal-readme');
    readmeLoading.style.display = 'flex';
    readmeContainer.innerHTML = '';
    
    // Fetch and render README
    try {
        await fetchAndRenderReadme(repo, readmeContainer);
        readmeLoading.style.display = 'none';
    } catch (error) {
        console.error('Error fetching README:', error);
        readmeLoading.style.display = 'none';
        readmeContainer.innerHTML = `
            <div class="readme-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load README. The repository might not have a README file or it's not accessible.</p>
            </div>
        `;
    }
    
    // Show the modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
    
    // Set up the close button directly
    document.querySelector('#close-repository-modal').onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeRepositoryModal();
        return false;
    };
}

/**
 * Fixes relative links in a README to absolute links
 * @param {HTMLElement} container - The container with the README HTML
 * @param {string} baseUrl - The base URL of the repository
 */
function fixRelativeLinks(container, baseUrl) {
    const links = container.querySelectorAll('a');
    const images = container.querySelectorAll('img');
    
    // Fix links
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
            link.setAttribute('href', `${baseUrl}/${href}`);
        }
        
        // Open external links in new tab
        if (href && (href.startsWith('http') || href.startsWith('www'))) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        }
    });
    
    // Fix images
    images.forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('http')) {
            img.setAttribute('src', `${baseUrl}/${src}`);
        }
    });
}

/**
 * Initializes the repository modal
 */
function initRepositoryModal() {
    // Create the modal if it doesn't exist
    if (!document.getElementById('repository-modal')) {
        const modalHtml = `
        <div id="repository-modal" class="repository-modal">
            <div class="repository-modal-content">
                <div class="repository-modal-header">
                    <button class="close-modal" id="close-repository-modal" onclick="closeRepositoryModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="repository-modal-body">
                    <div class="repository-modal-main">
                        <div class="repository-modal-banner" id="repository-modal-banner">
                            <!-- Banner image or generated background will be placed here -->
                        </div>
                        <h2 class="repository-modal-title" id="repository-modal-title">Repository Name</h2>
                        <div class="repository-modal-meta">
                            <span class="repository-modal-author" id="repository-modal-author">Author</span>
                            <span class="separator">•</span>
                            <span class="repository-modal-date" id="repository-modal-date">Date</span>
                        </div>
                        <div class="repository-modal-tags" id="repository-modal-tags">
                            <!-- Tags will be placed here -->
                        </div>
                        <div class="repository-modal-readme-container">
                            <div class="repository-modal-readme-header">
                                <h3>README</h3>
                                <div class="repository-modal-readme-loading" id="repository-modal-readme-loading">
                                    <div class="readme-spinner"></div>
                                    <span>Loading README...</span>
                                </div>
                            </div>
                            <div class="repository-modal-readme" id="repository-modal-readme">
                                <!-- README content will be placed here -->
                            </div>
                        </div>
                    </div>
                    <div class="repository-modal-sidebar">
                        <div class="repository-modal-author-info" id="repository-modal-author-info">
                            <div class="author-avatar-container">
                                <div class="author-avatar-placeholder" id="repository-modal-avatar-placeholder">
                                    <i class="fas fa-user"></i>
                                </div>
                                <img class="author-avatar" id="repository-modal-avatar" src="" alt="Author avatar" style="display: none;">
                            </div>
                            <div class="author-name" id="repository-modal-author-name">Author Name</div>
                        </div>
                        <div class="repository-modal-stats">
                            <div class="modal-stat">
                                <div class="modal-stat-icon">
                                    <i class="fas fa-star"></i>
                                </div>
                                <div class="modal-stat-content">
                                    <div class="modal-stat-value" id="repository-modal-stars">0</div>
                                    <div class="modal-stat-label">Stars</div>
                                </div>
                            </div>
                            <div class="modal-stat">
                                <div class="modal-stat-icon">
                                    <i class="fas fa-code-fork"></i>
                                </div>
                                <div class="modal-stat-content">
                                    <div class="modal-stat-value" id="repository-modal-forks">0</div>
                                    <div class="modal-stat-label">Forks</div>
                                </div>
                            </div>
                            <div class="modal-stat">
                                <div class="modal-stat-icon">
                                    <i class="fas fa-exclamation-circle"></i>
                                </div>
                                <div class="modal-stat-content">
                                    <div class="modal-stat-value" id="repository-modal-issues">0</div>
                                    <div class="modal-stat-label">Issues</div>
                                </div>
                            </div>
                            <div class="modal-stat">
                                <div class="modal-stat-icon">
                                    <i class="fas fa-eye"></i>
                                </div>
                                <div class="modal-stat-content">
                                    <div class="modal-stat-value" id="repository-modal-watchers">0</div>
                                    <div class="modal-stat-label">Watchers</div>
                                </div>
                            </div>
                        </div>
                        <div class="repository-modal-actions">
                            <a href="#" class="repository-modal-button primary" id="repository-modal-download" target="_blank">
                                <i class="fas fa-download"></i> Download
                            </a>
                            <a href="#" class="repository-modal-button secondary" id="repository-modal-github" target="_blank">
                                <i class="fab fa-github"></i> View on GitHub
                            </a>
                        </div>
                        <div class="repository-modal-details">
                            <div class="repository-modal-detail">
                                <div class="detail-label">Created:</div>
                                <div class="detail-value" id="repository-modal-created">--</div>
                            </div>
                            <div class="repository-modal-detail">
                                <div class="detail-label">Last updated:</div>
                                <div class="detail-value" id="repository-modal-updated">--</div>
                            </div>
                            <div class="repository-modal-detail">
                                <div class="detail-label">License:</div>
                                <div class="detail-value" id="repository-modal-license">--</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    // Add event listeners
    const closeButton = document.getElementById('close-repository-modal');
    const modal = document.getElementById('repository-modal');
    
    if (closeButton) {
        closeButton.addEventListener('click', function(e) {
            e.preventDefault();
            closeRepositoryModal();
        });
    }
    
    if (modal) {
        // Close the modal when clicking outside the content
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeRepositoryModal();
            }
        });
        
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                closeRepositoryModal();
            }
        });
    }
}
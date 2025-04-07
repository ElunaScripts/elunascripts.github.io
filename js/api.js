/**
 * API module - Handles all API interactions
 * This module contains functions for fetching data from the GitHub API
 * Optimized version to reduce API calls and improve performance
 */

/**
 * Fetches repositories from the GitHub API with caching
 * Simplified to prioritize performance and avoid rate limits
 */
async function fetchRepositories() {
    try {
        showLoading(true);
        hideError();
        
        // Check cache first
        const cacheResult = checkCache('eluna-repositories');
        if (cacheResult) {
            processRepositoryData(cacheResult);
            return;
        }
        
        const allRepositories = [];
        
        // Fetch only from GitHub topics, no additional calls for icons
        for (const topic of config.api.githubTopics) {
            try {
                const url = new URL(config.api.githubApiUrl);
                url.searchParams.append('q', `topic:${topic}`);
                url.searchParams.append('sort', 'stars');
                url.searchParams.append('order', 'desc');
                url.searchParams.append('per_page', '100');
                
                const response = await fetch(url.toString());
                
                if (!response.ok) {
                    // If rate limit exceeded, try to use cached data even if expired
                    if (response.status === 403) {
                        const expiredCacheResult = checkCache('eluna-repositories', true);
                        if (expiredCacheResult) {
                            processRepositoryData(expiredCacheResult);
                            showRateLimitWarning();
                            return;
                        }
                    }
                    
                    throw new Error(`GitHub API error for topic ${topic}: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                if (data.items && data.items.length > 0) {
                    allRepositories.push(...data.items);
                }
            } catch (error) {
                // Continue with other topics if one fails
            }
        }
        
        if (allRepositories.length === 0) {
            throw new Error('Could not fetch any repositories. GitHub API rate limit may have been exceeded.');
        }
        
        // Remove duplicates
        const uniqueRepositories = Array.from(
            new Map(allRepositories.map(repo => [repo.id, repo])).values()
        );
        
        
        // Save to cache
        saveToCache('eluna-repositories', uniqueRepositories);
        
        // Process the data (without fetching icons)
        processRepositoryData({ data: uniqueRepositories, timestamp: new Date().getTime() });
        
    } catch (error) {
        
        // Try to use cached data on error, even if expired
        const expiredCacheResult = checkCache('eluna-repositories', true);
        if (expiredCacheResult) {
            processRepositoryData(expiredCacheResult);
            showRateLimitWarning();
        } else {
            showError(error.message);
        }
    }
}

/**
 * Patch the fetchRepositories function to ensure it properly fetches complete repository data
 * including URLs needed for README and content lookup
 */
function patchFetchRepositories() {
    // Store reference to the original function
    const originalFetchRepositories = window.fetchRepositories;
    
    // Create an enhanced version that ensures we get all needed data
    window.fetchRepositories = async function() {
        try {
            await originalFetchRepositories();
            
            // Check if the repos have all the data we need
            const needsDetailedData = config.data.repositories.some(repo => !repo.url);
            
            if (needsDetailedData) {
                showInfoToast("Fetching additional repository data...");
                
                // Fetch detailed data for each repository
                const enhancedRepos = [];
                
                for (const repo of config.data.repositories) {
                    try {
                        if (!repo.url) {
                            // Fetch the detailed repository data
                            const response = await fetch(`https://api.github.com/repos/${repo.owner.login}/${repo.name}`);
                            
                            if (response.ok) {
                                const detailedRepo = await response.json();
                                enhancedRepos.push(detailedRepo);
                            } else {
                                // If failed, keep the original repo
                                enhancedRepos.push(repo);
                            }
                        } else {
                            enhancedRepos.push(repo);
                        }
                    } catch (error) {
                        console.error(`Error fetching details for ${repo.name}:`, error);
                        enhancedRepos.push(repo);
                    }
                }
                
                // Update the repositories with enhanced data
                config.data.repositories = enhancedRepos;
                config.data.filteredRepositories = [...enhancedRepos];
                
                // Save to cache
                saveToCache('eluna-repositories', enhancedRepos);
                
                // Process the data
                processRepositoryData({ data: enhancedRepos, timestamp: new Date().getTime() });
            }
        } catch (error) {
            console.error('Error in enhanced fetchRepositories:', error);
            showErrorToast("Failed to fetch all repository data");
        }
    };
}

/**
 * Configures the stars slider based on repository data
 */
function configureStarsSlider() {
    const starsSlider = document.querySelector('#stars-slider');
    if (!starsSlider) return;
    
    // Find the maximum number of stars
    const maxStars = Math.max(...config.data.repositories.map(repo => repo.stargazers_count));
    
    // Round up to the nearest 10
    const roundedMax = Math.ceil(maxStars / 10) * 10;
    
    // Update slider max attribute
    starsSlider.setAttribute('max', roundedMax);
    starsSlider.setAttribute('step', Math.max(1, Math.floor(roundedMax / 100)));
}

/**
 * Populates the authors filter with unique repository authors
 */
function populateAuthorsFilter() {
    const authorList = document.querySelector(config.selectors.authorList);
    if (!authorList) return;
    
    // Extract unique authors
    const authors = new Set();
    config.data.repositories.forEach(repo => {
        if (repo.owner && repo.owner.login) {
            authors.add(repo.owner.login);
        }
    });
    
    // Sort alphabetically
    const sortedAuthors = Array.from(authors).sort();
    
    // Clear the list
    authorList.innerHTML = '';
    
    // Add "All Authors" option
    const allAuthorsOption = document.createElement('div');
    allAuthorsOption.className = 'author-option active';
    allAuthorsOption.setAttribute('data-author', 'all');
    allAuthorsOption.innerHTML = `
        <div class="author-checkbox">
            <i class="fas fa-check"></i>
        </div>
        <span>All Authors</span>
    `;
    
    allAuthorsOption.addEventListener('click', () => {
        config.data.filters.author = '';
        document.querySelector(config.selectors.authorText).textContent = 'All Authors';
        
        // Update UI
        document.querySelectorAll('.author-option').forEach(option => {
            option.classList.toggle('active', option.getAttribute('data-author') === 'all');
        });
        
        filterRepositories();
        
        // Close dropdown
        const authorOptions = document.querySelector(config.selectors.authorOptions);
        if (authorOptions) {
            authorOptions.classList.remove('active');
        }
    });
    
    authorList.appendChild(allAuthorsOption);
    
    // Add all authors
    sortedAuthors.forEach(author => {
        const authorOption = document.createElement('div');
        authorOption.className = 'author-option';
        authorOption.setAttribute('data-author', author);
        authorOption.innerHTML = `
            <div class="author-checkbox">
                <i class="fas fa-check"></i>
            </div>
            <span>${author}</span>
        `;
        
        authorOption.addEventListener('click', () => {
            config.data.filters.author = author;
            document.querySelector(config.selectors.authorText).textContent = author;
            
            // Update UI
            document.querySelectorAll('.author-option').forEach(option => {
                option.classList.toggle('active', option.getAttribute('data-author') === author);
            });
            
            filterRepositories();
            
            // Close dropdown
            const authorOptions = document.querySelector(config.selectors.authorOptions);
            if (authorOptions) {
                authorOptions.classList.remove('active');
            }
        });
        
        authorList.appendChild(authorOption);
    });
}
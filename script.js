const config = {
  // GitHub API
  githubApiUrl: 'https://api.github.com/search/repositories',
  githubTopics: ['azerothcore-lua', 'trinitycore-lua'],
  perPage: 12,
  
  repositories: [],
  filteredRepositories: [],
  currentPage: 1,
  totalPages: 1,
  searchTerm: '',
  sortOption: 'stars',
  
  iconPatterns: [
    'icon.png', 'icon.jpg', 'icon.jpeg', 'icon.webp', 
    'logo.png', 'logo.jpg', 'logo.jpeg', 'logo.webp',
    'preview.png', 'preview.jpg', 'screenshot.png', 'screenshot.jpg'
  ],
  
  backgroundColors: [
    // Dégradés de gris-bleu
    ['#1a1a2e', '#16213e'],
    ['#0f0f1a', '#1f2037'],
    ['#171720', '#21212f'],
    ['#1e222a', '#252b34'],
    ['#121218', '#1a1a24'],
    // Dégradés de gris-argent
    ['#1e1e24', '#2d2d35'],
    ['#16161a', '#26262e'],
    ['#101018', '#202030'],
    ['#1c1c22', '#2a2a32'],
    ['#131320', '#1f1f30']
  ],
  
  backgroundShapes: [
    'circle',
    'square',
    'triangle',
    'diamond',
    'hexagon'
  ],
  
  selectors: {
    navbar: '#navbar',
    mobileMenuToggle: '#menu-toggle',
    mobileMenu: '#mobile-menu',
    searchInput: '#search-input',
    sortButton: '#sort-button',
    sortOptions: '#sort-options',
    sortText: '#sort-text',
    scriptsContainer: '#scripts-container',
    loadingContainer: '#loading-container',
    errorContainer: '#error-container',
    errorMessage: '#error-message',
    retryButton: '#retry-button',
    noResults: '#no-results',
    pagination: '#pagination',
    backToTop: '#back-to-top',
    repositoriesCount: '#repositories-count',
    contributorsCount: '#contributors-count',
    starsCount: '#stars-count'
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initSortMenu();
  initScrollEvents();
  initSearchEvents();
  fetchRepositories();
});

/**
 * Initialise le menu mobile
 */
function initMobileMenu() {
  const menuToggle = document.querySelector(config.selectors.mobileMenuToggle);
  const mobileMenu = document.querySelector(config.selectors.mobileMenu);
  
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileMenu.classList.toggle('active');
    });
    
    document.addEventListener('click', (event) => {
      if (!event.target.closest(config.selectors.mobileMenu) && 
          !event.target.closest(config.selectors.mobileMenuToggle) && 
          mobileMenu.classList.contains('active')) {
        mobileMenu.classList.remove('active');
      }
    });
  }
}

/**
 * Initialise le menu de tri
 */
function initSortMenu() {
  const sortButton = document.querySelector(config.selectors.sortButton);
  const sortOptions = document.querySelector(config.selectors.sortOptions);
  const sortOptionButtons = document.querySelectorAll('.sort-option');
  
  if (sortButton && sortOptions) {
    sortButton.addEventListener('click', (e) => {
      e.stopPropagation();
      sortOptions.classList.toggle('active');
    });
    
    document.addEventListener('click', (event) => {
      if (!event.target.closest(config.selectors.sortButton) && 
          sortOptions.classList.contains('active')) {
        sortOptions.classList.remove('active');
      }
    });
    
    sortOptionButtons.forEach(button => {
      button.addEventListener('click', () => {
        const sortValue = button.dataset.sort;
        const sortText = button.textContent;
        
        config.sortOption = sortValue;
        document.querySelector(config.selectors.sortText).textContent = sortText;
        
        sortOptions.classList.remove('active');
        
        sortRepositories();
        config.currentPage = 1;
        renderRepositories();
      });
    });
  }
}

/**
 * Initialise les événements de défilement
 */
function initScrollEvents() {
  const navbar = document.querySelector(config.selectors.navbar);
  const backToTopButton = document.querySelector(config.selectors.backToTop);
  
  let lastScrollTop = 0;
  
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    
    if (scrollTop > 100) {
      navbar.classList.add('scrolled');
      
      if (scrollTop > lastScrollTop && scrollTop > 300) {
        navbar.classList.add('hidden');
      } else {
        navbar.classList.remove('hidden');
      }
    } else {
      navbar.classList.remove('scrolled');
    }
    
    lastScrollTop = scrollTop;
    
    if (scrollTop > 500) {
      backToTopButton.classList.add('visible');
    } else {
      backToTopButton.classList.remove('visible');
    }
  });
  
  backToTopButton.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
  
  const statCards = document.querySelectorAll('.stat-card');
  const statObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = entry.target.dataset.statIndex || 0;
        entry.target.style.transitionDelay = `${index * 0.15}s`;
        entry.target.classList.add('animate-script-card');
        statObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  
  statCards.forEach(card => {
    statObserver.observe(card);
  });
}

/**
 * Initialise les événements de recherche
 */
function initSearchEvents() {
  const searchInput = document.querySelector(config.selectors.searchInput);
  
  if (searchInput) {
    let debounceTimeout;
    
    searchInput.addEventListener('input', (event) => {
      clearTimeout(debounceTimeout);
      
      debounceTimeout = setTimeout(() => {
        config.searchTerm = event.target.value.trim().toLowerCase();
        config.currentPage = 1;
        filterRepositories();
      }, 300);
    });
  }
}

/**
 * Récupère les repositories depuis l'API GitHub
 */
async function fetchRepositories() {
  try {
    showLoading(true);
    hideError();
    
    const allRepositories = [];
    
    for (const topic of config.githubTopics) {
      const url = new URL(config.githubApiUrl);
      url.searchParams.append('q', `topic:${topic}`);
      url.searchParams.append('sort', 'stars');
      url.searchParams.append('order', 'desc');
      url.searchParams.append('per_page', '100');
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`GitHub API error for topic ${topic}: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      allRepositories.push(...(data.items || []));
    }
    
    const uniqueRepositories = Array.from(
      new Map(allRepositories.map(repo => [repo.id, repo])).values()
    );
    
    config.repositories = uniqueRepositories;
    config.filteredRepositories = [...uniqueRepositories];
    
    await enrichRepositoriesWithIcons(config.repositories);
    
    updateStatsWithAnimation();
    
    sortRepositories();
    config.currentPage = 1;
    renderRepositories();
    
    showLoading(false);
  } catch (error) {
    console.error('Error fetching repositories:', error);
    showError(error.message);
  }
}

/**
 * Enrichit les repositories avec des icônes si disponibles
 * Méthode améliorée pour mieux trouver les icônes
 * @param {Array} repositories - Liste des repositories à enrichir
 */
async function enrichRepositoriesWithIcons(repositories) {
  const iconPromises = repositories.map(async (repo) => {
    try {
      for (const iconPattern of config.iconPatterns) {
        try {
          const directIconUrl = `https://raw.githubusercontent.com/${repo.full_name}/master/${iconPattern}`;
          
          const response = await fetch(directIconUrl, { method: 'HEAD' });
          
          if (response.ok) {
            repo.iconUrl = directIconUrl;
            return;
          }
        } catch (e) {
          continue;
        }
      }
      
      const contentsUrl = `${repo.url}/contents`;
      const response = await fetch(contentsUrl);
      
      if (response.ok) {
        const contents = await response.json();
        
        const iconFile = contents.find(file => 
          file.type === 'file' && config.iconPatterns.some(pattern => 
            file.name.toLowerCase() === pattern.toLowerCase()
          )
        );
        
        if (iconFile) {
          repo.iconUrl = iconFile.download_url;
          return;
        }
        
        const imageFolders = contents.filter(item => 
          item.type === 'dir' && ['images', 'img', 'assets', 'media', 'screenshots', 'resources'].includes(item.name.toLowerCase())
        );
        
        for (const folder of imageFolders) {
          try {
            const folderResponse = await fetch(folder.url);
            
            if (folderResponse.ok) {
              const folderContents = await folderResponse.json();
              
              for (const iconPattern of config.iconPatterns) {
                const iconFile = folderContents.find(file => 
                  file.type === 'file' && file.name.toLowerCase() === iconPattern.toLowerCase()
                );
                
                if (iconFile) {
                  repo.iconUrl = iconFile.download_url;
                  return;
                }
              }
              
              const imageFile = folderContents.find(file => 
                file.type === 'file' && 
                ['png', 'jpg', 'jpeg', 'webp', 'gif'].some(ext => file.name.toLowerCase().endsWith(`.${ext}`))
              );
              
              if (imageFile) {
                repo.iconUrl = imageFile.download_url;
                return;
              }
            }
          } catch (error) {
            continue;
          }
        }
      }
      
      await tryExtractImageFromReadme(repo);
      
      if (!repo.iconUrl) {
        repo.useGeneratedBackground = true;
      }
      
    } catch (error) {
      console.warn(`Could not fetch icon for ${repo.name}:`, error);
      repo.useGeneratedBackground = true;
    }
  });
  
  await Promise.allSettled(iconPromises);
}

/**
 * Tente d'extraire une image du README du repository
 * @param {Object} repo - Le repository
 */
async function tryExtractImageFromReadme(repo) {
  try {
    const readmeUrl = `${repo.url}/readme`;
    const response = await fetch(readmeUrl);
    
    if (!response.ok) {
      return;
    }
    
    const readmeData = await response.json();
    
    const content = atob(readmeData.content);
    
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    const matches = [...content.matchAll(imageRegex)];
    
    if (matches.length > 0) {
      let imageUrl = matches[0][1];
      
      if (imageUrl.startsWith('./') || imageUrl.startsWith('../') || !imageUrl.includes('://')) {
        const baseUrl = `https://raw.githubusercontent.com/${repo.full_name}/master/`;
        imageUrl = new URL(imageUrl, baseUrl).href;
      }
      
      repo.iconUrl = imageUrl;
    }
  } catch (error) {
    console.warn(`Could not extract image from README for ${repo.name}:`, error);
  }
}

/**
 * Génère un arrière-plan visuel basé sur le nom du repository
 * @param {Object} repo - Le repository
 * @param {HTMLElement} container - Le conteneur DOM pour l'arrière-plan
 */
function generateBackground(repo, container) {
  const seed = getHashCode(repo.name);
  
  const colorIndex = seed % config.backgroundColors.length;
  const gradient = config.backgroundColors[colorIndex];
  
  const bgElement = document.createElement('div');
  bgElement.className = 'script-banner-generated';
  
  bgElement.style.background = `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`;
  
  for (let i = 0; i < 3; i++) {
    const shapeElement = document.createElement('div');
    shapeElement.className = 'script-banner-shape';
    
    const shapeIndex = (seed + i) % config.backgroundShapes.length;
    const shape = config.backgroundShapes[shapeIndex];
    
    const size = 120 + ((seed * (i + 1)) % 80);
    const left = ((seed * (i + 3)) % 80);
    const top = ((seed * (i + 2)) % 80);
    const rotate = ((seed * (i + 1)) % 360);
    
    shapeElement.style.width = `${size}px`;
    shapeElement.style.height = `${size}px`;
    shapeElement.style.left = `${left}%`;
    shapeElement.style.top = `${top}%`;
    shapeElement.style.transform = `translate(-50%, -50%) rotate(${rotate}deg)`;
    
    switch (shape) {
      case 'circle':
        shapeElement.style.borderRadius = '50%';
        break;
      case 'square':
        shapeElement.style.borderRadius = '4px';
        break;
      case 'triangle':
        shapeElement.style.width = '0';
        shapeElement.style.height = '0';
        shapeElement.style.borderLeft = `${size / 2}px solid transparent`;
        shapeElement.style.borderRight = `${size / 2}px solid transparent`;
        shapeElement.style.borderBottom = `${size}px solid rgba(255, 255, 255, 0.05)`;
        break;
      case 'diamond':
        shapeElement.style.transform = `translate(-50%, -50%) rotate(45deg)`;
        break;
      case 'hexagon':
        shapeElement.style.clipPath = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
        break;
    }
    
    if (shape !== 'triangle') {
      shapeElement.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
    }
    
    bgElement.appendChild(shapeElement);
  }
  
  const letterElement = document.createElement('div');
  letterElement.className = 'script-banner-letter';
  letterElement.textContent = repo.name.charAt(0).toUpperCase();
  
  bgElement.appendChild(letterElement);
  container.appendChild(bgElement);
}

/**
 * Obtient un code de hachage pour une chaîne (pour créer des valeurs déterministes)
 * @param {String} str - La chaîne à hacher
 * @returns {Number} - Le code de hachage
 */
function getHashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Met à jour les statistiques avec une animation de comptage
 */
function updateStatsWithAnimation() {
  if (config.repositories.length > 0) {
    animateCounter(
      document.querySelector(config.selectors.repositoriesCount),
      0,
      config.repositories.length,
      1200
    );
    
    const uniqueContributors = new Set(
      config.repositories.map(repo => repo.owner.login)
    );
    animateCounter(
      document.querySelector(config.selectors.contributorsCount),
      0,
      uniqueContributors.size,
      1500
    );
    
    const totalStars = config.repositories.reduce(
      (sum, repo) => sum + repo.stargazers_count, 0
    );
    
    animateCounter(
      document.querySelector(config.selectors.starsCount),
      0,
      totalStars,
      1800,
      (value) => value > 1000 ? (value / 1000).toFixed(1) + 'k' : value
    );
  }
}

/**
 * Anime un compteur numérique de zéro à la valeur cible
 * @param {HTMLElement} element - L'élément DOM qui affiche le nombre
 * @param {Number} start - Valeur de départ
 * @param {Number} end - Valeur cible
 * @param {Number} duration - Durée de l'animation en ms
 * @param {Function} formatter - Fonction facultative pour formater la valeur
 */
function animateCounter(element, start, end, duration, formatter = null) {
  if (!element) return;
  
  const startTime = performance.now();
  const diff = end - start;
  
  function update(currentTime) {
    const elapsedTime = currentTime - startTime;
    
    if (elapsedTime > duration) {
      element.textContent = formatter ? formatter(end) : end;
      return;
    }
    
    const progress = elapsedTime / duration;
    const easeOutValue = 1 - Math.pow(1 - progress, 3);
    
    const currentValue = Math.floor(start + diff * easeOutValue);
    element.textContent = formatter ? formatter(currentValue) : currentValue;
    
    requestAnimationFrame(update);
  }
  
  requestAnimationFrame(update);
}

/**
 * Trie les repositories selon l'option sélectionnée
 */
function sortRepositories() {
  switch (config.sortOption) {
    case 'stars':
      config.filteredRepositories.sort((a, b) => b.stargazers_count - a.stargazers_count);
      break;
    case 'forks':
      config.filteredRepositories.sort((a, b) => b.forks_count - a.forks_count);
      break;
    case 'newest':
      config.filteredRepositories.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      break;
    case 'updated':
      config.filteredRepositories.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      break;
    default:
      config.filteredRepositories.sort((a, b) => b.stargazers_count - a.stargazers_count);
  }
}

/**
 * Filtre les repositories selon le terme de recherche
 */
function filterRepositories() {
  if (!config.searchTerm) {
    config.filteredRepositories = [...config.repositories];
  } else {
    config.filteredRepositories = config.repositories.filter(repo => {
      return (
        repo.name.toLowerCase().includes(config.searchTerm) ||
        (repo.description && repo.description.toLowerCase().includes(config.searchTerm)) ||
        repo.owner.login.toLowerCase().includes(config.searchTerm) ||
        (repo.topics && repo.topics.some(topic => topic.toLowerCase().includes(config.searchTerm)))
      );
    });
  }
  
  sortRepositories();
  renderRepositories();
}

/**
 * Affiche les repositories dans le conteneur
 */
function renderRepositories() {
  const container = document.querySelector(config.selectors.scriptsContainer);
  const noResultsElement = document.querySelector(config.selectors.noResults);
  
  const startIndex = (config.currentPage - 1) * config.perPage;
  const endIndex = startIndex + config.perPage;
  const repositoriesToShow = config.filteredRepositories.slice(startIndex, endIndex);
  
  config.totalPages = Math.ceil(config.filteredRepositories.length / config.perPage);
  
  container.innerHTML = '';
  
  if (config.filteredRepositories.length === 0) {
    noResultsElement.style.display = 'flex';
    renderPagination();
    return;
  } else {
    noResultsElement.style.display = 'none';
  }
  
  repositoriesToShow.forEach((repo, index) => {
    const card = createRepositoryCard(repo, index);
    container.appendChild(card);
  });
  
  renderPagination();
}

/**
 * Crée une carte pour un repository
 * @param {Object} repo - Le repository à afficher
 * @param {Number} index - L'index pour l'animation
 * @returns {HTMLElement} - L'élément de carte
 */
function createRepositoryCard(repo, index) {
  const template = document.querySelector('#script-card-template');
  const card = template.content.cloneNode(true);
  
  const cardElement = card.querySelector('.script-card');
  cardElement.style.animationDelay = `${index * 0.15}s`;
  
  const imageContainer = card.querySelector('.script-image-container');
  
  if (repo.iconUrl) {
    const imageElement = document.createElement('img');
    imageElement.className = 'script-image';
    imageElement.src = repo.iconUrl;
    imageElement.alt = repo.name;
    imageContainer.appendChild(imageElement);
  } else {
    generateBackground(repo, imageContainer);
  }
  
  card.querySelector('.script-title').textContent = formatRepoName(repo.name);
  card.querySelector('.script-author').textContent = repo.owner.login;
  card.querySelector('.script-date').textContent = formatDate(repo.created_at);
  card.querySelector('.script-description').textContent = repo.description || 'Aucune description disponible.';
  
  card.querySelector('.stars-value').textContent = repo.stargazers_count;
  card.querySelector('[data-metric="forks"]').textContent = repo.forks_count;
  card.querySelector('[data-metric="issues"]').textContent = repo.open_issues_count;
  card.querySelector('[data-metric="watchers"]').textContent = repo.watchers_count;
  
  const progressValue = calculateProgress(repo);
  const progressFill = card.querySelector('.progress-fill');
  const progressLabel = card.querySelector('.progress-label');
  
  progressFill.style.width = `${progressValue}%`;
  progressLabel.textContent = `${progressValue}%`;
  
  if (progressValue >= 80) {
    progressFill.style.backgroundColor = 'rgb(220, 220, 255)'; // Blanc néon
    progressLabel.style.color = 'rgb(220, 220, 255)';
  } else if (progressValue >= 50) {
    progressFill.style.backgroundColor = 'rgb(160, 160, 180)'; // Gris clair
    progressLabel.style.color = 'rgb(160, 160, 180)';
  } else {
    progressFill.style.backgroundColor = 'rgb(100, 100, 120)'; // Gris foncé
    progressLabel.style.color = 'rgb(100, 100, 120)';
  }
  
  const tagsContainer = card.querySelector('.script-tags');
  const topics = repo.topics || [];
  
  if (topics.length > 0) {
    topics.slice(0, 3).forEach(topic => {
      const tagElement = document.createElement('span');
      tagElement.className = 'script-tag';
      tagElement.textContent = topic;
      tagsContainer.appendChild(tagElement);
    });
  } else {
    ['Lua', 'Eluna', 'Script'].forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'script-tag';
      tagElement.textContent = tag;
      tagsContainer.appendChild(tagElement);
    });
  }
  
  const primaryButton = card.querySelector('.script-button.primary');
  const secondaryButton = card.querySelector('.script-button.secondary');
  
  primaryButton.href = `${repo.html_url}/archive/refs/heads/master.zip`;
  secondaryButton.href = repo.html_url;
  
  return card;
}

/**
 * Formate le nom du repository pour l'affichage
 * @param {String} name - Le nom brut du repository
 * @returns {String} - Le nom formaté
 */
function formatRepoName(name) {
  name = name.replace(/[-_]/g, ' ');
  
  return name.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Formate une date pour l'affichage
 * @param {String} dateString - La date au format ISO
 * @returns {String} - La date formatée
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('fr-FR', options);
}

/**
 * Calcule un pourcentage de progression pour le repository
 * @param {Object} repo - Le repository
 * @returns {Number} - Le pourcentage de progression (0-100)
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
 * Vérifie si un repository a été mis à jour récemment
 * @param {String} dateString - La date de mise à jour au format ISO
 * @returns {Boolean} - True si mis à jour dans les 3 derniers mois
 */
function isRecentlyUpdated(dateString) {
  const updateDate = new Date(dateString);
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  return updateDate > threeMonthsAgo;
}

/**
 * Affiche ou masque le loader avec animation
 * @param {Boolean} show - True pour afficher, False pour masquer
 */
function showLoading(show) {
  const loadingContainer = document.querySelector(config.selectors.loadingContainer);
  
  if (loadingContainer) {
    if (show) {
      loadingContainer.style.display = 'flex';
      loadingContainer.style.opacity = '0';
      
      setTimeout(() => {
        loadingContainer.style.opacity = '1';
      }, 10);
    } else {
      loadingContainer.style.opacity = '0';
      
      setTimeout(() => {
        loadingContainer.style.display = 'none';
      }, 300);
    }
  }
}

/**
 * Affiche un message d'erreur
 * @param {String} message - Le message d'erreur
 */
function showError(message) {
  const errorContainer = document.querySelector(config.selectors.errorContainer);
  const errorMessageElement = document.querySelector(config.selectors.errorMessage);
  const retryButton = document.querySelector(config.selectors.retryButton);
  
  if (errorContainer && errorMessageElement) {
    showLoading(false);
    
    errorMessageElement.textContent = message;
    
    errorContainer.style.display = 'flex';
    errorContainer.style.opacity = '0';
    
    setTimeout(() => {
      errorContainer.style.opacity = '1';
    }, 10);
    
    if (retryButton) {
      retryButton.addEventListener('click', () => {
        hideError();
        fetchRepositories();
      });
    }
  }
}

/**
 * Masque le message d'erreur
 */
function hideError() {
  const errorContainer = document.querySelector(config.selectors.errorContainer);
  
  if (errorContainer) {
    errorContainer.style.opacity = '0';
    
    setTimeout(() => {
      errorContainer.style.display = 'none';
    }, 300);
  }
}

/**
 * Affiche la pagination
 */
function renderPagination() {
  const paginationContainer = document.querySelector(config.selectors.pagination);
  
  if (!paginationContainer) return;
  
  paginationContainer.innerHTML = '';
  
  if (config.totalPages <= 0) return;
  
  const prevButton = document.createElement('button');
  prevButton.className = `pagination-button ${config.currentPage === 1 ? 'disabled' : ''}`;
  prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
  
  if (config.currentPage > 1) {
    prevButton.addEventListener('click', () => {
      navigateToPage(config.currentPage - 1);
    });
  }
  
  paginationContainer.appendChild(prevButton);
  
  let startPage = Math.max(1, config.currentPage - 2);
  let endPage = Math.min(config.totalPages, startPage + 4);
  
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }
  
  if (startPage > 1) {
    const firstPageButton = document.createElement('button');
    firstPageButton.className = 'pagination-button';
    firstPageButton.textContent = '1';
    firstPageButton.addEventListener('click', () => {
      navigateToPage(1);
    });
    paginationContainer.appendChild(firstPageButton);
    
    if (startPage > 2) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'pagination-ellipsis';
      ellipsis.textContent = '...';
      paginationContainer.appendChild(ellipsis);
    }
  }
  
  for (let i = startPage; i <= endPage; i++) {
    const pageButton = document.createElement('button');
    pageButton.className = `pagination-button ${i === config.currentPage ? 'active' : ''}`;
    pageButton.textContent = i.toString();
    
    if (i !== config.currentPage) {
      pageButton.addEventListener('click', () => {
        navigateToPage(i);
      });
    }
    
    paginationContainer.appendChild(pageButton);
  }
  
  if (endPage < config.totalPages) {
    if (endPage < config.totalPages - 1) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'pagination-ellipsis';
      ellipsis.textContent = '...';
      paginationContainer.appendChild(ellipsis);
    }
    
    const lastPageButton = document.createElement('button');
    lastPageButton.className = 'pagination-button';
    lastPageButton.textContent = config.totalPages.toString();
    lastPageButton.addEventListener('click', () => {
      navigateToPage(config.totalPages);
    });
    paginationContainer.appendChild(lastPageButton);
  }
  
  const nextButton = document.createElement('button');
  nextButton.className = `pagination-button ${config.currentPage === config.totalPages ? 'disabled' : ''}`;
  nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
  
  if (config.currentPage < config.totalPages) {
    nextButton.addEventListener('click', () => {
      navigateToPage(config.currentPage + 1);
    });
  }
  
  paginationContainer.appendChild(nextButton);
}

/**
 * Navigue vers la page spécifiée
 * @param {Number} page - La page à afficher
 */
function navigateToPage(page) {
  if (page < 1 || page > config.totalPages) return;
  
  config.currentPage = page;
  
  const scriptsSection = document.querySelector('.scripts-section');
  if (scriptsSection) {
    scriptsSection.scrollIntoView({ behavior: 'smooth' });
  }
  
  renderRepositories();
}
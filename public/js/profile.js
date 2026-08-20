document.addEventListener('DOMContentLoaded', () => {
  // Extract username from URL path: e.g. /alice -> alice
  const path = window.location.pathname;
  const username = path.substring(1).split('/')[0];

  if (!username) {
    showError();
    return;
  }

  fetchProfileData(username);
});

async function fetchProfileData(username) {
  try {
    const response = await fetch(`/api/public/profile/${username}`);
    if (!response.ok) {
      throw new Error('Profile not found');
    }

    const data = await response.json();
    hydrateProfile(data);
  } catch (error) {
    console.error('Error fetching public profile:', error);
    showError();
  }
}

// Extract YouTube ID helper
function getYouTubeVideoId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function hydrateProfile(data) {
  const { profile, links } = data;
  const body = document.getElementById('profile-body');
  const container = document.getElementById('profile-container');
  
  // 1. Set chosen theme class
  body.className = 'profile-wrapper'; // reset
  body.classList.add(`theme-${profile.theme_id || 'midnight-premium'}`);

  // Special animated blobs for Midnight Premium theme (and backward compatible variants)
  const existingBlobs = body.querySelector('.theme-midnight-premium-bg-blobs') || body.querySelector('.theme-midnight-aurora-bg-blobs');
  if (existingBlobs) existingBlobs.remove();

  const isDarkTheme = profile.theme_id === 'midnight-premium' || profile.theme_id === 'glass-dark' || profile.theme_id === 'midnight-aurora';
  if (isDarkTheme) {
    const blobs = document.createElement('div');
    blobs.className = 'theme-midnight-premium-bg-blobs';
    body.appendChild(blobs);
  }

  // Set layout mode class (Centered Smartphone vs Full Page width on desktop)
  initLayoutToggle(profile.layout_mode);

  // 2. Set Custom background overrides
  if (profile.bg_type === 'color' || profile.bg_type === 'gradient') {
    body.style.background = profile.custom_bg;
    body.style.backgroundImage = profile.custom_bg;
  } else {
    body.style.background = '';
    body.style.backgroundImage = '';
  }

  // 3. Set custom fonts
  body.classList.remove('font-outfit', 'font-inter', 'font-playfair', 'font-grotesk');
  const font = profile.font_family || 'Outfit';
  if (font === 'Outfit') body.classList.add('font-outfit');
  else if (font === 'Inter') body.classList.add('font-inter');
  else if (font === 'Playfair Display') body.classList.add('font-playfair');
  else if (font === 'Space Grotesk') body.classList.add('font-grotesk');

  // 4. Set Page title
  document.title = `${profile.name || profile.username} - Build Your Link`;

  // 5. Set avatar image (fallback to initials avatar if not set)
  const avatarImg = document.getElementById('avatar-img');
  if (profile.avatar_url && profile.avatar_url.trim() !== '') {
    avatarImg.src = profile.avatar_url;
  } else {
    avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || profile.username)}&background=a855f7&color=fff&size=128`;
  }

  // 6. Set profile name and bio
  document.getElementById('display-name').textContent = profile.name || `@${profile.username}`;
  document.getElementById('bio-text').textContent = profile.bio || '';

  // Show verified checkmark credentials badges
  document.getElementById('name-verified').style.display = 'inline-block';
  document.getElementById('avatar-verified').style.display = 'flex';

  // 7. Render socials row
  const socialsRow = document.getElementById('socials-row');
  socialsRow.innerHTML = '';

  const socialIconMap = {
    instagram: { icon: 'fa-brands fa-instagram', prefix: 'https://instagram.com/' },
    twitter: { icon: 'fa-brands fa-x-twitter', prefix: 'https://twitter.com/' },
    youtube: { icon: 'fa-brands fa-youtube', prefix: 'https://youtube.com/' },
    tiktok: { icon: 'fa-brands fa-tiktok', prefix: 'https://tiktok.com/@' },
    facebook: { icon: 'fa-brands fa-facebook', prefix: 'https://facebook.com/' },
    github: { icon: 'fa-brands fa-github', prefix: 'https://github.com/' },
    linkedin: { icon: 'fa-brands fa-linkedin', prefix: 'https://linkedin.com/in/' },
    whatsapp: { icon: 'fa-brands fa-whatsapp', prefix: 'https://wa.me/' },
    email: { icon: 'fa-solid fa-envelope', prefix: 'mailto:' },
    phone: { icon: 'fa-solid fa-phone', prefix: 'tel:' }
  };

  if (profile.social_links) {
    Object.entries(profile.social_links).forEach(([platform, value]) => {
      if (!value || value.trim() === '') return;

      const mapping = socialIconMap[platform];
      if (!mapping) return;

      let href = value.trim();
      if (mapping.prefix && !href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        href = mapping.prefix + href;
      }

      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'social-icon-btn';
      a.title = platform.charAt(0).toUpperCase() + platform.slice(1);
      
      const icon = document.createElement('i');
      icon.className = mapping.icon;
      
      a.appendChild(icon);
      socialsRow.appendChild(a);
    });
  }

  // 8. Render multi-type blocks stack
  const linksStack = document.getElementById('links-stack');
  linksStack.innerHTML = '';

  // Class strings for shape and outline styles overrides
  const shapeClass = `btn-shape-${profile.btn_shape || 'rounded'}`;
  const styleClass = `btn-style-${profile.btn_style || 'solid'}`;

  if (links && links.length > 0) {
    links.forEach(link => {
      const blockType = link.type || 'link';

      if (blockType === 'text') {
        // Render section text header
        const heading = document.createElement('div');
        heading.className = 'profile-text-block';
        heading.textContent = link.title;
        linksStack.appendChild(heading);
      } 
      else if (blockType === 'youtube') {
        // Render responsive youtube player iframe card
        const videoId = getYouTubeVideoId(link.url);
        if (videoId) {
          const videoCard = document.createElement('div');
          videoCard.className = 'youtube-embed-container';
          
          // Apply button corners shape selection
          if (profile.btn_shape === 'sharp') videoCard.style.borderRadius = '0px';
          else if (profile.btn_shape === 'pill') videoCard.style.borderRadius = '24px';
          else videoCard.style.borderRadius = '12px';

          videoCard.innerHTML = `
            <iframe src="https://www.youtube.com/embed/${videoId}" 
                    title="${link.title || 'YouTube Video'}" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen></iframe>
          `;
          linksStack.appendChild(videoCard);
        }
      } 
      else if (blockType === 'instagram' || blockType === 'facebook' || blockType === 'linkedin') {
        // Render custom branded social button with left icon and right chevron
        const a = document.createElement('a');
        a.href = link.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = `link-btn brand-btn brand-${blockType} ${shapeClass} ${styleClass}`;
        
        let icon = 'fa-instagram';
        if (blockType === 'facebook') icon = 'fa-facebook';
        else if (blockType === 'linkedin') icon = 'fa-linkedin';

        a.innerHTML = `
          <i class="fa-brands ${icon} link-btn-icon"></i>
          <span class="link-btn-text">${link.title}</span>
          <i class="fa-solid fa-chevron-right link-btn-chevron"></i>
        `;
        
        a.addEventListener('click', () => {
          fetch(`/api/public/click/${link.id}`, {
            method: 'POST',
            keepalive: true
          }).catch(err => console.error('Click tracking error:', err));
        });

        linksStack.appendChild(a);
      }
      else {
        // Render standard redirect button with auto icon detection and right chevron
        const a = document.createElement('a');
        a.href = link.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = `link-btn ${shapeClass} ${styleClass}`;
        
        const iconClass = getLinkIcon(link.url, link.title);
        a.innerHTML = `
          <i class="${iconClass} link-btn-icon"></i>
          <span class="link-btn-text">${link.title}</span>
          <i class="fa-solid fa-chevron-right link-btn-chevron"></i>
        `;
        
        a.addEventListener('click', () => {
          fetch(`/api/public/click/${link.id}`, {
            method: 'POST',
            keepalive: true
          }).catch(err => console.error('Click tracking error:', err));
        });

        linksStack.appendChild(a);
      }
    });

    // Hydrate Contact Me email footer link
    const contactFooter = document.getElementById('contact-footer');
    if (profile.social_links && profile.social_links.email) {
      contactFooter.href = `mailto:${profile.social_links.email.trim()}`;
      contactFooter.style.display = 'inline-flex';
    } else {
      contactFooter.style.display = 'none';
    }
  } else {
    const noLinksMsg = document.createElement('div');
    noLinksMsg.style.textAlign = 'center';
    noLinksMsg.style.padding = '2.5rem';
    noLinksMsg.style.color = 'var(--text-secondary)';
    noLinksMsg.style.fontStyle = 'italic';
    noLinksMsg.textContent = 'No links added yet.';
    linksStack.appendChild(noLinksMsg);
  }

  container.style.display = 'flex';
}

function showError() {
  document.getElementById('profile-container').style.display = 'none';
  document.getElementById('error-container').style.display = 'block';
}

// Real-time communication messaging receiver
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'preview-update') {
    hydrateProfile(event.data.payload);
  }
});

// Visitor Layout Toggle Pill Controller
let isToggleInitialized = false;
function initLayoutToggle(defaultLayout) {
  const togglePill = document.getElementById('layout-toggle-pill');
  const toggleMobile = document.getElementById('toggle-mobile');
  const toggleWeb = document.getElementById('toggle-web');
  const container = document.getElementById('profile-container');
  const body = document.getElementById('profile-body');

  if (!togglePill || !toggleMobile || !toggleWeb) return;

  // Use visitor cached preference, fallback to owner chosen default layout
  let currentLayout = localStorage.getItem('visitor-layout-preference') || defaultLayout || 'mobile-card';
  applyLayout(currentLayout);

  if (!isToggleInitialized) {
    toggleMobile.addEventListener('click', () => {
      currentLayout = 'mobile-card';
      localStorage.setItem('visitor-layout-preference', currentLayout);
      applyLayout(currentLayout);
    });

    toggleWeb.addEventListener('click', () => {
      currentLayout = 'full-page';
      localStorage.setItem('visitor-layout-preference', currentLayout);
      applyLayout(currentLayout);
    });
    isToggleInitialized = true;
  }

  function applyLayout(layout) {
    container.classList.remove('layout-mobile-card', 'layout-full-page');
    body.classList.remove('has-layout-mobile-card');

    if (layout === 'full-page') {
      container.classList.add('layout-full-page');
      toggleWeb.classList.add('active');
      toggleMobile.classList.remove('active');
    } else {
      container.classList.add('layout-mobile-card');
      body.classList.add('has-layout-mobile-card');
      toggleMobile.classList.add('active');
      toggleWeb.classList.remove('active');
    }
  }
}

// Dynamic icon detector based on URL patterns & titles
function getLinkIcon(url, title) {
  const cleanUrl = (url || '').toLowerCase();
  const cleanTitle = (title || '').toLowerCase();
  
  if (cleanUrl.includes('github') || cleanTitle.includes('github')) return 'fa-brands fa-github';
  if (cleanUrl.includes('youtube') || cleanTitle.includes('youtube')) return 'fa-brands fa-youtube';
  if (cleanUrl.includes('linkedin') || cleanTitle.includes('linkedin')) return 'fa-brands fa-linkedin';
  if (cleanUrl.includes('instagram') || cleanTitle.includes('instagram')) return 'fa-brands fa-instagram';
  if (cleanUrl.includes('facebook') || cleanTitle.includes('facebook')) return 'fa-brands fa-facebook';
  if (cleanUrl.includes('twitter') || cleanUrl.includes('x.com') || cleanTitle.includes('twitter') || cleanTitle.includes('x.com')) return 'fa-brands fa-x-twitter';
  if (cleanUrl.includes('tiktok') || cleanTitle.includes('tiktok')) return 'fa-brands fa-tiktok';
  if (cleanUrl.includes('whatsapp') || cleanTitle.includes('whatsapp')) return 'fa-brands fa-whatsapp';
  if (cleanUrl.includes('mailto:') || cleanTitle.includes('email') || cleanTitle.includes('contact')) return 'fa-solid fa-envelope';
  
  return 'fa-solid fa-globe';
}

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

function hydrateProfile(data) {
  const { profile, links } = data;
  const body = document.getElementById('profile-body');
  const container = document.getElementById('profile-container');
  
  // 1. Set chosen theme class
  body.className = 'profile-wrapper'; // reset
  body.classList.add(`theme-${profile.theme_id || 'glass-dark'}`);

  // Special animated blobs for Midnight Aurora theme
  if (profile.theme_id === 'midnight-aurora') {
    const blobs = document.createElement('div');
    blobs.className = 'theme-midnight-aurora-bg-blobs';
    body.appendChild(blobs);
  }

  // 2. Set Page title
  document.title = `${profile.name || profile.username} - Build Your Link`;

  // 3. Set avatar image (fallback to default initials avatar if not set)
  const avatarImg = document.getElementById('avatar-img');
  if (profile.avatar_url && profile.avatar_url.trim() !== '') {
    avatarImg.src = profile.avatar_url;
  } else {
    avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || profile.username)}&background=a855f7&color=fff&size=128`;
  }

  // 4. Set profile name and bio
  document.getElementById('display-name').textContent = profile.name || `@${profile.username}`;
  document.getElementById('bio-text').textContent = profile.bio || '';

  // 5. Render socials row
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
    phone: { icon: 'fa-solid fa-phone', prefix: 'tel:' },
    website: { icon: 'fa-solid fa-globe', prefix: '' }
  };

  if (profile.social_links) {
    Object.entries(profile.social_links).forEach(([platform, value]) => {
      if (!value || value.trim() === '') return;

      const mapping = socialIconMap[platform];
      if (!mapping) return;

      let href = value.trim();
      // Add prefix if user only supplied handle and it is not already a full link
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

  // 6. Render links list
  const linksStack = document.getElementById('links-stack');
  linksStack.innerHTML = '';

  if (links && links.length > 0) {
    links.forEach(link => {
      const a = document.createElement('a');
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'link-btn';
      a.textContent = link.title;
      
      // Bind click tracker
      a.addEventListener('click', (e) => {
        // Send analytics click beacon in background (keepalive ensures it succeeds even if page unloads)
        fetch(`/api/public/click/${link.id}`, {
          method: 'POST',
          keepalive: true
        }).catch(err => console.error('Failed to log click:', err));
      });

      linksStack.appendChild(a);
    });
  } else {
    // Show info message if no links are active
    const noLinksMsg = document.createElement('div');
    noLinksMsg.style.textAlign = 'center';
    noLinksMsg.style.padding = '2rem';
    noLinksMsg.style.color = 'var(--text-secondary)';
    noLinksMsg.style.fontStyle = 'italic';
    noLinksMsg.textContent = 'No links added yet.';
    linksStack.appendChild(noLinksMsg);
  }

  // 7. Show profile container
  container.style.display = 'flex';
}

function showError() {
  document.getElementById('profile-container').style.display = 'none';
  document.getElementById('error-container').style.display = 'block';
}

// Listen to message events from dashboard parent for live real-time preview editing
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'preview-update') {
    hydrateProfile(event.data.payload);
  }
});


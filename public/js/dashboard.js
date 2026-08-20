// Helper for backward compatibility theme mapping
function mapThemeId(themeId) {
  const map = {
    'glass-dark': 'midnight-premium',
    'midnight-aurora': 'midnight-premium',
    'sunset-glow': 'corporate-navy',
    'forest-breeze': 'sage-portfolio',
    'neo-brutalism': 'minimalist-ivory'
  };
  return map[themeId] || themeId || 'midnight-premium';
}

// Dashboard Local State
let state = {
  username: '',
  role: '',
  profile: {
    name: '',
    bio: '',
    avatar_url: '',
    theme_id: 'glass-dark',
    social_links: {},
    font_family: 'Outfit',
    bg_type: 'preset',
    custom_bg: '',
    btn_shape: 'rounded',
    btn_style: 'solid'
  },
  links: [] // array of links: { id, title, url, sort_order, is_active, type }
};

// QR Code instance
let qrCodeGenerator = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verify User login status
  await checkAuthStatus();
  
  // 2. Fetch User configuration
  await Promise.all([
    fetchProfile(),
    fetchLinks()
  ]);

  // 3. Setup Live Iframe Preview load hook
  const iframe = document.getElementById('phone-viewport-iframe');
  iframe.src = `/${state.username}`;
  iframe.addEventListener('load', () => {
    updatePreview();
  });

  // 4. Bind forms and custom styling events
  bindFormEvents();
  bindStyleCustomizerEvents();

  // Set default view layout
  setView('editor');
  
  // Set default block inputs visibility
  toggleBlockTypeInputs();
});

// Switch editor workspace views (Editor vs Analytics grids)
function setView(viewName) {
  const wrapper = document.getElementById('dashboard-main-wrapper');
  const contentSec = document.getElementById('editor-content-sec');
  const styleSec = document.getElementById('editor-style-sec');
  const analyticsSec = document.getElementById('analytics-sec');
  
  // Update nav buttons selection
  document.querySelectorAll('.nav-toggle-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`nav-btn-${viewName}`);
  if (activeBtn) activeBtn.classList.add('active');

  if (viewName === 'editor') {
    wrapper.style.gridTemplateColumns = '1.2fr 1fr 340px';
    contentSec.style.display = 'flex';
    styleSec.style.display = 'flex';
    analyticsSec.classList.remove('active-view');
  } else {
    // Analytics Full Width
    wrapper.style.gridTemplateColumns = '2.2fr 340px';
    contentSec.style.display = 'none';
    styleSec.style.display = 'none';
    analyticsSec.classList.add('active-view');
    
    // Fetch stats
    fetchAnalytics();
  }
}

// Verify Auth & Bootstrap User info
async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    
    if (!data.loggedIn) {
      window.location.href = '/login.html';
      return;
    }

    state.username = data.user.username;
    state.role = data.user.role;

    document.getElementById('header-username').textContent = `@${state.username}`;
    document.getElementById('view-my-page-btn').href = `/${state.username}`;
    
    if (state.role === 'admin') {
      document.getElementById('admin-nav-item').style.display = 'block';
    }
  } catch (err) {
    console.error('Auth verification failed:', err);
    window.location.href = '/login.html';
  }
}

// Fetch user profile data
async function fetchProfile() {
  try {
    const res = await fetch('/api/profile');
    if (!res.ok) throw new Error('Failed to fetch profile.');
    const profile = await res.json();

    state.profile = profile;
    state.profile.username = state.username; 

    // Fill inputs
    document.getElementById('profile-display-name').value = profile.name || '';
    document.getElementById('profile-bio').value = profile.bio || '';
    document.getElementById('profile-avatar-url').value = profile.avatar_url || '';
    
    const avatarPreview = document.getElementById('profile-avatar-preview');
    if (profile.avatar_url) {
      avatarPreview.src = profile.avatar_url;
    } else {
      avatarPreview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || state.username)}&background=a855f7&color=fff`;
    }

    // Set layout mode, font family, card corners shape, button border styles
    document.getElementById('profile-layout-select').value = profile.layout_mode || 'mobile-card';
    document.getElementById('profile-font-select').value = profile.font_family || 'Outfit';
    document.getElementById('profile-shape-select').value = profile.btn_shape || 'rounded';
    document.getElementById('profile-style-select').value = profile.btn_style || 'solid';

    // Set background type selection
    document.getElementById('bg-type-select').value = profile.bg_type || 'preset';

    // Parse backgrounds if custom is set
    if (profile.bg_type === 'color' && profile.custom_bg) {
      document.getElementById('bg-solid-color').value = profile.custom_bg;
      document.getElementById('bg-solid-hex').value = profile.custom_bg;
    } else if (profile.bg_type === 'gradient' && profile.custom_bg) {
      const hexes = profile.custom_bg.match(/#[0-9a-fA-F]{6}/g);
      if (hexes && hexes.length >= 2) {
        document.getElementById('bg-grad-start').value = hexes[0];
        document.getElementById('bg-grad-start-hex').value = hexes[0];
        document.getElementById('bg-grad-end').value = hexes[1];
        document.getElementById('bg-grad-end-hex').value = hexes[1];
      }
    }
    
    handleBgTypeChange();

    // Fill socials
    const socials = profile.social_links || {};
    document.getElementById('social-instagram').value = socials.instagram || '';
    document.getElementById('social-twitter').value = socials.twitter || '';
    document.getElementById('social-youtube').value = socials.youtube || '';
    document.getElementById('social-tiktok').value = socials.tiktok || '';
    document.getElementById('social-facebook').value = socials.facebook || '';
    document.getElementById('social-github').value = socials.github || '';
    document.getElementById('social-linkedin').value = socials.linkedin || '';
    document.getElementById('social-whatsapp').value = socials.whatsapp || '';
    document.getElementById('social-email').value = socials.email || '';
    document.getElementById('social-phone').value = socials.phone || '';

    // Mark current theme selected in UI
    const activeThemeId = mapThemeId(profile.theme_id);
    document.querySelectorAll('.theme-card-option').forEach(card => {
      card.classList.remove('selected');
      if (card.dataset.theme === activeThemeId) {
        card.classList.add('selected');
      }
    });

  } catch (err) {
    console.error(err);
  }
}

// Fetch user links list
async function fetchLinks() {
  try {
    const res = await fetch('/api/links');
    if (!res.ok) throw new Error('Failed to load links');
    const links = await res.json();

    state.links = links;
    renderLinksList();
  } catch (err) {
    console.error(err);
  }
}

// Render content blocks lists in the content editor (Column 1)
function renderLinksList() {
  const container = document.getElementById('links-container');
  container.innerHTML = '';

  if (state.links.length === 0) {
    container.innerHTML = `
      <p style="color: #718096; font-style: italic; text-align: center; padding: 2.5rem;">
        No active blocks yet. Select type and create your first block above!
      </p>`;
    return;
  }

  state.links.forEach((link, index) => {
    const item = document.createElement('div');
    item.className = 'link-list-item';
    item.dataset.id = link.id;

    const upDisabled = index === 0 ? 'disabled style="opacity:0.2; cursor:default;"' : '';
    const downDisabled = index === state.links.length - 1 ? 'disabled style="opacity:0.2; cursor:default;"' : '';

    // Form inputs depending on block type
    let blockTypeBadge = '🔗 Button';
    let urlInputHtml = `<input type="url" class="link-url-input" value="${link.url || ''}" onchange="updateLinkData(${link.id}, 'url', this.value)" placeholder="Destination URL">`;
    let titlePlaceholder = 'Link Button Title';

    if (link.type === 'text') {
      blockTypeBadge = '✏️ Divider Text';
      urlInputHtml = ''; // Divider blocks don't hold URLs
      titlePlaceholder = 'Divider Heading Text';
    } else if (link.type === 'youtube') {
      blockTypeBadge = '🎥 YouTube Player';
      titlePlaceholder = 'Video Heading (Optional)';
      urlInputHtml = `<input type="url" class="link-url-input" value="${link.url || ''}" onchange="updateLinkData(${link.id}, 'url', this.value)" placeholder="YouTube Video URL (watch or short url)">`;
    }

    item.innerHTML = `
      <!-- Up/Down reordering arrow buttons -->
      <div style="display:flex; flex-direction:column; gap:4px; align-items:center; justify-content:center;">
        <button onclick="moveLink(${index}, -1)" ${upDisabled} style="background:none; border:none; color:#a0aec0; cursor:pointer;" title="Move Up"><i class="fa-solid fa-caret-up"></i></button>
        <button onclick="moveLink(${index}, 1)" ${downDisabled} style="background:none; border:none; color:#a0aec0; cursor:pointer;" title="Move Down"><i class="fa-solid fa-caret-down"></i></button>
      </div>

      <!-- Details Inputs -->
      <div class="link-details" style="flex:1;">
        <div style="font-size:0.75rem; color:#718096; font-weight:700; margin-bottom:2px; display:flex; align-items:center; gap:4px;">
          <span>${blockTypeBadge}</span>
        </div>
        <input type="text" class="link-title-input" value="${link.title}" onchange="updateLinkData(${link.id}, 'title', this.value)" placeholder="${titlePlaceholder}">
        ${urlInputHtml}
      </div>

      <!-- Action Items toggle switch & Delete -->
      <div class="link-actions">
        <label class="switch">
          <input type="checkbox" ${link.is_active ? 'checked' : ''} onchange="updateLinkData(${link.id}, 'is_active', this.checked)">
          <span class="slider"></span>
        </label>
        <button class="btn-danger-icon" onclick="deleteLink(${link.id})" title="Delete Block">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;

    container.appendChild(item);
  });
}

// Reordering elements inside links list arrays
async function moveLink(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= state.links.length) return;

  const temp = state.links[index];
  state.links[index] = state.links[targetIndex];
  state.links[targetIndex] = temp;

  renderLinksList();
  updatePreview();

  const orderedIds = state.links.map(l => l.id);
  try {
    const res = await fetch('/api/links/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds })
    });
    if (!res.ok) throw new Error('Reordering failed on server.');
  } catch (err) {
    console.error(err);
  }
}

// Inline content updates
async function updateLinkData(linkId, field, value) {
  const link = state.links.find(l => l.id === linkId);
  if (!link) return;

  link[field] = value;
  updatePreview();

  try {
    const res = await fetch(`/api/links/${linkId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: link.title,
        url: link.url,
        is_active: link.is_active
      })
    });
    if (!res.ok) throw new Error('Failed to save edit.');
  } catch (err) {
    console.error(err);
  }
}

// Delete Block
async function deleteLink(linkId) {
  if (!confirm('Are you sure you want to delete this block?')) return;

  state.links = state.links.filter(l => l.id !== linkId);
  renderLinksList();
  updatePreview();

  try {
    const res = await fetch(`/api/links/${linkId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed.');
  } catch (err) {
    console.error(err);
  }
}

// Sync live state variables to preview mockup page
function updatePreview() {
  const iframe = document.getElementById('phone-viewport-iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({
      type: 'preview-update',
      payload: {
        profile: state.profile,
        links: state.links.filter(l => l.is_active)
      }
    }, '*');
  }
}

// Hard reload preview frame if needed
function reloadPreview() {
  const iframe = document.getElementById('phone-viewport-iframe');
  if (iframe) {
    iframe.src = `/${state.username}`;
  }
}

// Toggle block inputs based on type
function toggleBlockTypeInputs() {
  const type = document.getElementById('block-type-select').value;
  const titleInput = document.getElementById('new-link-title');
  const urlInput = document.getElementById('new-link-url');
  const urlGroup = document.getElementById('block-url-group');

  if (type === 'text') {
    titleInput.placeholder = 'Divider Heading Text (e.g. ✏️ My Projects)';
    urlGroup.style.display = 'none';
    urlInput.required = false;
  } else if (type === 'youtube') {
    titleInput.placeholder = 'Video Block Title (Optional)';
    urlInput.placeholder = 'YouTube URL (e.g. https://www.youtube.com/watch?v=...)';
    urlGroup.style.display = 'block';
    urlInput.required = true;
  } else if (type === 'instagram') {
    titleInput.placeholder = 'Instagram Button Title (e.g. Follow my Instagram)';
    urlInput.placeholder = 'Instagram Profile URL (e.g. https://instagram.com/username)';
    urlGroup.style.display = 'block';
    urlInput.required = true;
  } else if (type === 'facebook') {
    titleInput.placeholder = 'Facebook Button Title (e.g. Like our Facebook Page)';
    urlInput.placeholder = 'Facebook URL (e.g. https://facebook.com/page)';
    urlGroup.style.display = 'block';
    urlInput.required = true;
  } else if (type === 'linkedin') {
    titleInput.placeholder = 'LinkedIn Button Title (e.g. Connect on LinkedIn)';
    urlInput.placeholder = 'LinkedIn URL (e.g. https://linkedin.com/in/username)';
    urlGroup.style.display = 'block';
    urlInput.required = true;
  } else {
    titleInput.placeholder = 'Button Title (e.g. My Website)';
    urlInput.placeholder = 'Destination URL (e.g. https://domain.com)';
    urlGroup.style.display = 'block';
    urlInput.required = true;
  }
}

// Bind Form actions
function bindFormEvents() {
  // 1. Add Block Submit
  document.getElementById('add-link-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('block-type-select').value;
    const titleInput = document.getElementById('new-link-title');
    const urlInput = document.getElementById('new-link-url');

    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: titleInput.value, 
          url: type === 'text' ? '' : urlInput.value, 
          type: type 
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add block');

      state.links.push(data.link);
      renderLinksList();
      updatePreview();

      titleInput.value = '';
      urlInput.value = '';
    } catch (err) {
      alert(err.message);
    }
  });

  // 2. Edit Profile Info
  document.getElementById('profile-details-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const displayName = document.getElementById('profile-display-name').value;
    const bio = document.getElementById('profile-bio').value;
    const avatarUrl = document.getElementById('profile-avatar-url').value;

    state.profile.name = displayName;
    state.profile.bio = bio;
    state.profile.avatar_url = avatarUrl;

    const avatarPreview = document.getElementById('profile-avatar-preview');
    if (avatarUrl) {
      avatarPreview.src = avatarUrl;
    } else {
      avatarPreview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || state.username)}&background=a855f7&color=fff`;
    }

    updatePreview();
    await saveProfile(true);
  });

  // 3. Edit Social connectors
  document.getElementById('social-links-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const socials = {
      instagram: document.getElementById('social-instagram').value.trim(),
      twitter: document.getElementById('social-twitter').value.trim(),
      youtube: document.getElementById('social-youtube').value.trim(),
      tiktok: document.getElementById('social-tiktok').value.trim(),
      facebook: document.getElementById('social-facebook').value.trim(),
      github: document.getElementById('social-github').value.trim(),
      linkedin: document.getElementById('social-linkedin').value.trim(),
      whatsapp: document.getElementById('social-whatsapp').value.trim(),
      email: document.getElementById('social-email').value.trim(),
      phone: document.getElementById('social-phone').value.trim()
    };

    state.profile.social_links = socials;
    updatePreview();
    await saveProfile(true);
  });

  // Bind key inputs for instant preview syncing (as they type)
  document.getElementById('profile-display-name').addEventListener('input', (e) => {
    state.profile.name = e.target.value;
    updatePreview();
  });
  document.getElementById('profile-bio').addEventListener('input', (e) => {
    state.profile.bio = e.target.value;
    updatePreview();
  });
  document.getElementById('profile-avatar-url').addEventListener('input', (e) => {
    state.profile.avatar_url = e.target.value;
    updatePreview();
  });
}

// Bind Styling adjustments & background pickers
function bindStyleCustomizerEvents() {
  // Bind hex changes to color pickers
  document.getElementById('bg-solid-hex').addEventListener('input', (e) => {
    const val = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      document.getElementById('bg-solid-color').value = val;
      syncCustomBackground();
    }
  });

  document.getElementById('bg-grad-start-hex').addEventListener('input', (e) => {
    const val = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      document.getElementById('bg-grad-start').value = val;
      syncCustomBackground();
    }
  });

  document.getElementById('bg-grad-end-hex').addEventListener('input', (e) => {
    const val = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      document.getElementById('bg-grad-end').value = val;
      syncCustomBackground();
    }
  });
}

// Save profile variables to server database
async function saveProfile(showAlert = false) {
  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: state.profile.name,
        bio: state.profile.bio,
        avatar_url: state.profile.avatar_url,
        social_links: state.profile.social_links,
        font_family: state.profile.font_family,
        bg_type: state.profile.bg_type,
        custom_bg: state.profile.custom_bg,
        btn_shape: state.profile.btn_shape,
        btn_style: state.profile.btn_style,
        layout_mode: state.profile.layout_mode
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save configuration');
    if (showAlert) alert('Profile updated successfully!');
  } catch (err) {
    console.error(err);
    if (showAlert) alert(err.message);
  }
}

// Debounced silent saving helper
let silentSaveTimeout = null;
function saveProfileSilently() {
  clearTimeout(silentSaveTimeout);
  silentSaveTimeout = setTimeout(() => {
    saveProfile(false);
  }, 800);
}

// Select design theme preset
function selectTheme(themeId) {
  state.profile.theme_id = themeId;
  
  document.querySelectorAll('.theme-card-option').forEach(card => {
    card.classList.remove('selected');
    if (card.dataset.theme === themeId) card.classList.add('selected');
  });

  // Re-enable preset background
  state.profile.bg_type = 'preset';
  document.getElementById('bg-type-select').value = 'preset';
  handleBgTypeChange();

  updatePreview();
  saveProfileSilently();
}

// Background Type changer toggles inputs
function handleBgTypeChange() {
  const bgType = document.getElementById('bg-type-select').value;
  state.profile.bg_type = bgType;

  const solidGroup = document.getElementById('bg-color-picker-group');
  const gradGroup = document.getElementById('bg-gradient-picker-group');

  if (bgType === 'color') {
    solidGroup.style.display = 'block';
    gradGroup.style.display = 'none';
  } else if (bgType === 'gradient') {
    solidGroup.style.display = 'none';
    gradGroup.style.display = 'flex';
  } else {
    solidGroup.style.display = 'none';
    gradGroup.style.display = 'none';
  }

  syncCustomBackground();
}

// Create linear gradients or solid colors dynamically
function syncCustomBackground() {
  const bgType = state.profile.bg_type;
  if (bgType === 'color') {
    const val = document.getElementById('bg-solid-color').value;
    document.getElementById('bg-solid-hex').value = val;
    state.profile.custom_bg = val;
  } else if (bgType === 'gradient') {
    const start = document.getElementById('bg-grad-start').value;
    const end = document.getElementById('bg-grad-end').value;
    document.getElementById('bg-grad-start-hex').value = start;
    document.getElementById('bg-grad-end-hex').value = end;
    state.profile.custom_bg = `linear-gradient(135deg, ${start} 0%, ${end} 100%)`;
  } else {
    state.profile.custom_bg = '';
  }

  updatePreview();
  saveProfileSilently();
}

// Bind other custom shapes/fonts
function syncCustomStyles() {
  state.profile.layout_mode = document.getElementById('profile-layout-select').value;
  state.profile.font_family = document.getElementById('profile-font-select').value;
  state.profile.btn_shape = document.getElementById('profile-shape-select').value;
  state.profile.btn_style = document.getElementById('profile-style-select').value;

  updatePreview();
  saveProfileSilently();
}

// ==========================================
// ANALYTICS & SVG GRAPH CHARTING
// ==========================================
async function fetchAnalytics() {
  try {
    const res = await fetch('/api/analytics');
    if (!res.ok) throw new Error('Could not fetch analytics.');
    const data = await res.json();

    document.getElementById('analytics-views').textContent = data.total_views;
    document.getElementById('analytics-clicks').textContent = data.total_clicks;

    const tableBody = document.querySelector('#analytics-links-table tbody');
    tableBody.innerHTML = '';
    
    if (data.links && data.links.length > 0) {
      data.links.forEach(link => {
        const tr = document.createElement('tr');
        // Filter subheadings/dividers showing click data
        let blockDetails = `<strong>${link.title}</strong>`;
        if (link.url) blockDetails += `<div style="font-size:0.75rem; color:#718096; word-break:break-all;">${link.url}</div>`;
        tr.innerHTML = `
          <td style="padding: 0.75rem 0.5rem; color:#fff;">
            ${blockDetails}
          </td>
          <td style="padding: 0.75rem 0.5rem; text-align: right; color:#a855f7; font-weight:700;">${link.clicks}</td>
        `;
        tableBody.appendChild(tr);
      });
    } else {
      tableBody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:1.5rem; color:#718096;">No clicks logged.</td></tr>';
    }

    const referrerList = document.getElementById('analytics-referrers-list');
    referrerList.innerHTML = '';
    
    if (data.referrers && data.referrers.length > 0) {
      data.referrers.forEach(ref => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justify = 'space-between';
        li.style.alignItems = 'center';
        li.style.gap = '1rem';
        li.style.marginBottom = '0.5rem';
        li.innerHTML = `
          <span style="color:#e2e8f0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; flex: 1; max-width: 75%;" title="${ref.referrer || 'Direct Link / Bookmark'}">${ref.referrer || 'Direct Link / Bookmark'}</span>
          <span style="color:#06b6d4; font-weight:700; flex-shrink: 0;">${ref.count} views</span>
        `;
        referrerList.appendChild(li);
      });
    } else {
      referrerList.innerHTML = '<li style="color:#718096; font-style:italic;">No referral data recorded.</li>';
    }

    // Graph pre-population (last 7 days)
    const dailyMap = {};
    if (data.daily) {
      data.daily.forEach(d => {
        dailyMap[d.event_date] = { views: d.views, clicks: d.clicks };
      });
    }

    const fullDailyStats = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const stats = dailyMap[dateStr] || { views: 0, clicks: 0 };
      fullDailyStats.push({
        event_date: dateStr,
        views: stats.views,
        clicks: stats.clicks
      });
    }

    drawAnalyticsChart(fullDailyStats);

  } catch (err) {
    console.error(err);
  }
}

function drawAnalyticsChart(dailyData) {
  const svg = document.getElementById('analytics-svg');
  svg.innerHTML = '';

  if (!dailyData || dailyData.length === 0) {
    svg.innerHTML = `
      <text x="250" y="100" text-anchor="middle" fill="#718096" font-size="14" font-style="italic">
        No visitor activity logged in the past 7 days.
      </text>`;
    return;
  }

  const width = 500;
  const height = 200;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  let maxVal = 5;
  dailyData.forEach(day => {
    if (day.views > maxVal) maxVal = day.views;
    if (day.clicks > maxVal) maxVal = day.clicks;
  });
  
  maxVal = Math.ceil(maxVal * 1.2);
  const numPoints = dailyData.length;
  
  for (let i = 0; i <= 4; i++) {
    const gridY = paddingTop + plotHeight - (plotHeight * (i / 4));
    const valY = Math.round(maxVal * (i / 4));
    
    const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    gridLine.setAttribute('x1', paddingLeft);
    gridLine.setAttribute('y1', gridY);
    gridLine.setAttribute('x2', width - paddingRight);
    gridLine.setAttribute('y2', gridY);
    gridLine.setAttribute('stroke', 'rgba(255,255,255,0.06)');
    gridLine.setAttribute('stroke-dasharray', '4 4');
    svg.appendChild(gridLine);

    const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yLabel.setAttribute('x', paddingLeft - 8);
    yLabel.setAttribute('y', gridY + 4);
    yLabel.setAttribute('text-anchor', 'end');
    yLabel.setAttribute('fill', '#718096');
    yLabel.setAttribute('font-size', '10');
    yLabel.setAttribute('font-weight', 'bold');
    yLabel.textContent = valY;
    svg.appendChild(yLabel);
  }

  const viewsPoints = [];
  const clicksPoints = [];
  const dates = [];

  dailyData.forEach((day, index) => {
    const x = paddingLeft + (plotWidth * (index / (numPoints - 1 || 1)));
    const yViews = paddingTop + plotHeight - (plotHeight * (day.views / maxVal));
    const yClicks = paddingTop + plotHeight - (plotHeight * (day.clicks / maxVal));

    viewsPoints.push({ x, y: yViews, count: day.views });
    clicksPoints.push({ x, y: yClicks, count: day.clicks });
    
    const dateParts = day.event_date.split('-');
    dates.push({ x, label: `${dateParts[1]}/${dateParts[2]}` });
  });

  dates.forEach(d => {
    const xText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xText.setAttribute('x', d.x);
    xText.setAttribute('y', height - 8);
    xText.setAttribute('text-anchor', 'middle');
    xText.setAttribute('fill', '#718096');
    xText.setAttribute('font-size', '9');
    xText.textContent = d.label;
    svg.appendChild(xText);
  });

  const makePathString = (points) => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  };

  const viewsPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  viewsPath.setAttribute('d', makePathString(viewsPoints));
  viewsPath.setAttribute('fill', 'none');
  viewsPath.setAttribute('stroke', '#06b6d4');
  viewsPath.setAttribute('stroke-width', '2.5');
  viewsPath.setAttribute('stroke-linecap', 'round');
  svg.appendChild(viewsPath);

  const clicksPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  clicksPath.setAttribute('d', makePathString(clicksPoints));
  clicksPath.setAttribute('fill', 'none');
  clicksPath.setAttribute('stroke', '#a855f7');
  clicksPath.setAttribute('stroke-width', '2.5');
  clicksPath.setAttribute('stroke-linecap', 'round');
  svg.appendChild(clicksPath);

  viewsPoints.forEach(p => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', p.x);
    circle.setAttribute('cy', p.y);
    circle.setAttribute('r', '3.5');
    circle.setAttribute('fill', '#0f172a');
    circle.setAttribute('stroke', '#06b6d4');
    circle.setAttribute('stroke-width', '1.5');
    
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${p.count} Views`;
    circle.appendChild(title);
    svg.appendChild(circle);
  });

  clicksPoints.forEach(p => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', p.x);
    circle.setAttribute('cy', p.y);
    circle.setAttribute('r', '3.5');
    circle.setAttribute('fill', '#0f172a');
    circle.setAttribute('stroke', '#a855f7');
    circle.setAttribute('stroke-width', '1.5');
    
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${p.count} Clicks`;
    circle.appendChild(title);
    svg.appendChild(circle);
  });
}

// ==========================================
// SHARING & QR CODE MANAGEMENT
// ==========================================
function openShareModal() {
  const modal = document.getElementById('share-modal');
  const shareInput = document.getElementById('share-link-input');
  const shareUrl = `${window.location.protocol}//${window.location.host}/${state.username}`;
  
  shareInput.value = shareUrl;
  modal.classList.add('active');

  if (typeof QRious !== 'undefined') {
    qrCodeGenerator = new QRious({
      element: document.getElementById('qr-canvas'),
      value: shareUrl,
      size: 180,
      background: '#ffffff',
      foreground: '#000000',
      level: 'H'
    });
  }
}

function closeShareModal() {
  document.getElementById('share-modal').classList.remove('active');
}

function copyShareLink() {
  const shareInput = document.getElementById('share-link-input');
  shareInput.select();
  shareInput.setSelectionRange(0, 99999);

  navigator.clipboard.writeText(shareInput.value)
    .then(() => alert('Link copied!'))
    .catch(() => alert('Failed to copy. Please manually copy the link.'));
}

function downloadQrCode() {
  const canvas = document.getElementById('qr-canvas');
  if (!canvas) return;

  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `build-your-link-${state.username}-qr.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ==========================================
// LOGOUT COMMAND
// ==========================================
async function handleLogout() {
  if (!confirm('Are you sure you want to log out?')) return;
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      window.location.href = '/login.html';
    }
  } catch (err) {
    console.error('Logout error:', err);
  }
}
window.toggleBlockTypeInputs = toggleBlockTypeInputs;

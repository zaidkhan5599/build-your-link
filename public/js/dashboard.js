// Dashboard Local State
let state = {
  username: '',
  role: '',
  profile: {
    name: '',
    bio: '',
    avatar_url: '',
    theme_id: 'glass-dark',
    social_links: {}
  },
  links: [] // array of links: { id, title, url, sort_order, is_active }
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

  // 4. Bind forms
  bindFormEvents();
});

// Verify Auth & Bootstrap User info
async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    
    if (!data.loggedIn) {
      // Not logged in, send to login
      window.location.href = '/login.html';
      return;
    }

    state.username = data.user.username;
    state.role = data.user.role;

    // Hydrate Header usernames
    document.getElementById('header-username').textContent = `@${state.username}`;
    document.getElementById('view-my-page-btn').href = `/${state.username}`;
    
    // Toggle Admin navigation item
    if (state.role === 'admin') {
      document.getElementById('admin-nav-item').style.display = 'block';
    }
  } catch (err) {
    console.error('Auth verification failed:', err);
    window.location.href = '/login.html';
  }
}

// TAB Switcher
function switchTab(tabId) {
  // Hide all contents and deactivate tabs
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  // Activate chosen
  document.getElementById(tabId).classList.add('active');
  
  // Activate tab button (finding by onclick text)
  const buttons = Array.from(document.querySelectorAll('.tab-btn'));
  const matchingBtn = buttons.find(b => b.getAttribute('onclick').includes(tabId));
  if (matchingBtn) matchingBtn.classList.add('active');

  // If entering analytics, reload statistics
  if (tabId === 'tab-analytics') {
    fetchAnalytics();
  }
}

// Fetch user profile data
async function fetchProfile() {
  try {
    const res = await fetch('/api/profile');
    if (!res.ok) throw new Error('Failed to fetch profile.');
    const profile = await res.json();

    state.profile = profile;

    // Fill TAB 2 inputs
    document.getElementById('profile-display-name').value = profile.name || '';
    document.getElementById('profile-bio').value = profile.bio || '';
    document.getElementById('profile-avatar-url').value = profile.avatar_url || '';
    
    const avatarPreview = document.getElementById('profile-avatar-preview');
    if (profile.avatar_url) {
      avatarPreview.src = profile.avatar_url;
    } else {
      avatarPreview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || state.username)}&background=a855f7&color=fff`;
    }

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

    // Mark current theme selected in TAB 3 UI
    document.querySelectorAll('.theme-card-option').forEach(card => {
      card.classList.remove('selected');
      if (card.dataset.theme === profile.theme_id) {
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

// Render the links stack in the config panel
function renderLinksList() {
  const container = document.getElementById('links-container');
  container.innerHTML = '';

  if (state.links.length === 0) {
    container.innerHTML = `
      <p style="color: #718096; font-style: italic; text-align: center; padding: 2rem;">
        No links added yet. Create your first link above!
      </p>`;
    return;
  }

  state.links.forEach((link, index) => {
    const item = document.createElement('div');
    item.className = 'link-list-item';
    item.dataset.id = link.id;

    // Up/Down reordering arrow buttons
    const upDisabled = index === 0 ? 'disabled style="opacity:0.2; cursor:default;"' : '';
    const downDisabled = index === state.links.length - 1 ? 'disabled style="opacity:0.2; cursor:default;"' : '';

    item.innerHTML = `
      <!-- Reorder Controls -->
      <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
        <button onclick="moveLink(${index}, -1)" ${upDisabled} style="background:none; border:none; color:#a0aec0; cursor:pointer;" title="Move Up"><i class="fa-solid fa-caret-up"></i></button>
        <button onclick="moveLink(${index}, 1)" ${downDisabled} style="background:none; border:none; color:#a0aec0; cursor:pointer;" title="Move Down"><i class="fa-solid fa-caret-down"></i></button>
      </div>

      <!-- Details Inputs -->
      <div class="link-details">
        <input type="text" class="link-title-input" value="${link.title}" onchange="updateLinkData(${link.id}, 'title', this.value)" placeholder="Link Title">
        <input type="url" class="link-url-input" value="${link.url}" onchange="updateLinkData(${link.id}, 'url', this.value)" placeholder="Destination URL">
      </div>

      <!-- Action items -->
      <div class="link-actions">
        <!-- Active Switch -->
        <label class="switch">
          <input type="checkbox" ${link.is_active ? 'checked' : ''} onchange="updateLinkData(${link.id}, 'is_active', this.checked)">
          <span class="slider"></span>
        </label>
        <!-- Delete Button -->
        <button class="btn-danger-icon" onclick="deleteLink(${link.id})" title="Delete Link">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;

    container.appendChild(item);
  });
}

// Up/Down reordering handler
async function moveLink(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= state.links.length) return;

  // Swap elements in memory
  const temp = state.links[index];
  state.links[index] = state.links[targetIndex];
  state.links[targetIndex] = temp;

  // Rerender list immediately (responsive UI)
  renderLinksList();
  updatePreview();

  // Send reordered IDs to API
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

// In-line update link properties (title, url, active toggle)
async function updateLinkData(linkId, field, value) {
  const link = state.links.find(l => l.id === linkId);
  if (!link) return;

  // Update memory
  link[field] = value;

  // Update preview instantly
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
    if (!res.ok) throw new Error('Failed to update link details on server.');
  } catch (err) {
    console.error(err);
  }
}

// Delete Link
async function deleteLink(linkId) {
  if (!confirm('Are you sure you want to delete this link?')) return;

  // Update memory
  state.links = state.links.filter(l => l.id !== linkId);
  
  // Render and update preview
  renderLinksList();
  updatePreview();

  try {
    const res = await fetch(`/api/links/${linkId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed on server.');
  } catch (err) {
    console.error(err);
  }
}

// Sync edits to iframe preview viewport
function updatePreview() {
  const iframe = document.getElementById('phone-viewport-iframe');
  if (iframe && iframe.contentWindow) {
    // Send message to hydrate iframe profile page in real time
    iframe.contentWindow.postMessage({
      type: 'preview-update',
      payload: {
        profile: state.profile,
        // Send only active links to live preview
        links: state.links.filter(l => l.is_active)
      }
    }, '*');
  }
}

// Bind Form submits
function bindFormEvents() {
  // 1. Add link form
  document.getElementById('add-link-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('new-link-title');
    const urlInput = document.getElementById('new-link-url');

    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleInput.value, url: urlInput.value })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add link');

      // Append to memory and update UI
      state.links.push(data.link);
      renderLinksList();
      updatePreview();

      // Clear input fields
      titleInput.value = '';
      urlInput.value = '';
    } catch (err) {
      alert(err.message);
    }
  });

  // 2. Profile Details Form
  document.getElementById('profile-details-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const displayName = document.getElementById('profile-display-name').value;
    const bio = document.getElementById('profile-bio').value;
    const avatarUrl = document.getElementById('profile-avatar-url').value;

    state.profile.name = displayName;
    state.profile.bio = bio;
    state.profile.avatar_url = avatarUrl;

    // Update avatar preview image
    const avatarPreview = document.getElementById('profile-avatar-preview');
    if (avatarUrl) {
      avatarPreview.src = avatarUrl;
    } else {
      avatarPreview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || state.username)}&background=a855f7&color=fff`;
    }

    updatePreview();
    await saveProfile();
  });

  // 3. Socials Connector Form
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
    await saveProfile();
  });

  // Listen to input changes in textboxes for instant live-preview sync (as typing happens)
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

// Save profile state to backend
async function saveProfile() {
  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: state.profile.name,
        bio: state.profile.bio,
        avatar_url: state.profile.avatar_url,
        social_links: state.profile.social_links
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save profile');
    alert('Profile configurations updated successfully!');
  } catch (err) {
    alert(err.message);
  }
}

// Select design theme
async function selectTheme(themeId) {
  state.profile.theme_id = themeId;
  
  // Highlight UI chosen
  document.querySelectorAll('.theme-card-option').forEach(card => {
    card.classList.remove('selected');
    if (card.dataset.theme === themeId) card.classList.add('selected');
  });

  updatePreview();

  try {
    await fetch('/api/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme_id: themeId })
    });
  } catch (err) {
    console.error('Failed to save theme choice:', err);
  }
}

// ==========================================
// ANALYTICS & SVG GRAPH CHARTING
// ==========================================
async function fetchAnalytics() {
  try {
    const res = await fetch('/api/analytics');
    if (!res.ok) throw new Error('Could not fetch analytics.');
    const data = await res.json();

    // 1. Total boxes
    document.getElementById('analytics-views').textContent = data.total_views;
    document.getElementById('analytics-clicks').textContent = data.total_clicks;

    // 2. Links clicks breakdown table
    const tableBody = document.querySelector('#analytics-links-table tbody');
    tableBody.innerHTML = '';
    
    if (data.links && data.links.length > 0) {
      data.links.forEach(link => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="padding: 0.75rem 0.5rem; color:#fff;">
            <strong>${link.title}</strong>
            <div style="font-size:0.8rem; color:#718096; word-break:break-all;">${link.url}</div>
          </td>
          <td style="padding: 0.75rem 0.5rem; text-align: right; color:#a855f7; font-weight:700;">${link.clicks}</td>
        `;
        tableBody.appendChild(tr);
      });
    } else {
      tableBody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:1.5rem; color:#718096;">No click events logged.</td></tr>';
    }

    // 3. Referrers list
    const referrerList = document.getElementById('analytics-referrers-list');
    referrerList.innerHTML = '';
    
    if (data.referrers && data.referrers.length > 0) {
      data.referrers.forEach(ref => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justify = 'space-between';
        li.innerHTML = `
          <span style="color:#e2e8f0;">${ref.referrer || 'Direct Link / Bookmark'}</span>
          <span style="color:#06b6d4; font-weight:700;">${ref.count} views</span>
        `;
        referrerList.appendChild(li);
      });
    } else {
      referrerList.innerHTML = '<li style="color:#718096; font-style:italic;">No referral data recorded.</li>';
    }

    // 4. Render SVG Chart
    drawAnalyticsChart(data.daily);

  } catch (err) {
    console.error(err);
  }
}

// Hand-drawn responsive SVG line chart
function drawAnalyticsChart(dailyData) {
  const svg = document.getElementById('analytics-svg');
  svg.innerHTML = ''; // reset

  // If no data
  if (!dailyData || dailyData.length === 0) {
    svg.innerHTML = `
      <text x="250" y="100" text-anchor="middle" fill="#718096" font-size="14" font-style="italic">
        No visitor activity logged in the past 7 days.
      </text>`;
    return;
  }

  // Define chart parameters
  const width = 500;
  const height = 200;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  // Find max value to scale the Y-axis (views or clicks)
  let maxVal = 5; // minimum axis limit
  dailyData.forEach(day => {
    if (day.views > maxVal) maxVal = day.views;
    if (day.clicks > maxVal) maxVal = day.clicks;
  });
  
  // Add 20% breathing room to Y-axis limit
  maxVal = Math.ceil(maxVal * 1.2);

  const numPoints = dailyData.length;
  
  // Draw Background Gridlines (4 levels)
  for (let i = 0; i <= 4; i++) {
    const gridY = paddingTop + plotHeight - (plotHeight * (i / 4));
    const valY = Math.round(maxVal * (i / 4));
    
    // Gridline path
    const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    gridLine.setAttribute('x1', paddingLeft);
    gridLine.setAttribute('y1', gridY);
    gridLine.setAttribute('x2', width - paddingRight);
    gridLine.setAttribute('y2', gridY);
    gridLine.setAttribute('stroke', 'rgba(255,255,255,0.06)');
    gridLine.setAttribute('stroke-dasharray', '4 4');
    svg.appendChild(gridLine);

    // Y Axis Label
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

  // Calculate coordinates
  const viewsPoints = [];
  const clicksPoints = [];
  const dates = [];

  dailyData.forEach((day, index) => {
    // Distribute along X-axis
    const x = paddingLeft + (plotWidth * (index / (numPoints - 1 || 1)));
    
    // Calculate scaled Y-coordinates
    const yViews = paddingTop + plotHeight - (plotHeight * (day.views / maxVal));
    const yClicks = paddingTop + plotHeight - (plotHeight * (day.clicks / maxVal));

    viewsPoints.push({ x, y: yViews, count: day.views });
    clicksPoints.push({ x, y: yClicks, count: day.clicks });
    
    // Format date string from YYYY-MM-DD to MM/DD
    const dateParts = day.event_date.split('-');
    dates.push({ x, label: `${dateParts[1]}/${dateParts[2]}` });
  });

  // Draw X Axis dates
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

  // Function to create line path string
  const makePathString = (points) => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      // Linear connections
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  };

  // 1. Draw views path (Cyan Line)
  const viewsPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  viewsPath.setAttribute('d', makePathString(viewsPoints));
  viewsPath.setAttribute('fill', 'none');
  viewsPath.setAttribute('stroke', '#06b6d4');
  viewsPath.setAttribute('stroke-width', '2.5');
  viewsPath.setAttribute('stroke-linecap', 'round');
  svg.appendChild(viewsPath);

  // 2. Draw clicks path (Purple Line)
  const clicksPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  clicksPath.setAttribute('d', makePathString(clicksPoints));
  clicksPath.setAttribute('fill', 'none');
  clicksPath.setAttribute('stroke', '#a855f7');
  clicksPath.setAttribute('stroke-width', '2.5');
  clicksPath.setAttribute('stroke-linecap', 'round');
  svg.appendChild(clicksPath);

  // 3. Draw Dots on View points
  viewsPoints.forEach(p => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', p.x);
    circle.setAttribute('cy', p.y);
    circle.setAttribute('r', '3.5');
    circle.setAttribute('fill', '#0f172a');
    circle.setAttribute('stroke', '#06b6d4');
    circle.setAttribute('stroke-width', '1.5');
    
    // Simple tooltip showing value
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${p.count} Views`;
    circle.appendChild(title);

    svg.appendChild(circle);
  });

  // 4. Draw Dots on Click points
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
  
  // Build public address path
  const shareUrl = `${window.location.protocol}//${window.location.host}/${state.username}`;
  shareInput.value = shareUrl;

  modal.classList.add('active');

  // Load and draw QR code
  if (typeof QRious !== 'undefined') {
    qrCodeGenerator = new QRious({
      element: document.getElementById('qr-canvas'),
      value: shareUrl,
      size: 180,
      background: '#ffffff',
      foreground: '#000000',
      level: 'H' // High correction
    });
  }
}

function closeShareModal() {
  document.getElementById('share-modal').classList.remove('active');
}

function copyShareLink() {
  const shareInput = document.getElementById('share-link-input');
  shareInput.select();
  shareInput.setSelectionRange(0, 99999); // Mobile compatibility

  navigator.clipboard.writeText(shareInput.value)
    .then(() => alert('Link copied to clipboard!'))
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

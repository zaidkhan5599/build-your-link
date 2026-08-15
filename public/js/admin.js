document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verify user is logged in AND is an admin
  await verifyAdminStatus();

  // 2. Fetch and render platform data
  await fetchAdminData();
});

async function verifyAdminStatus() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    
    if (!data.loggedIn) {
      window.location.href = '/login.html';
      return;
    }

    if (data.user.role !== 'admin') {
      alert('Access Denied. Admin privileges required.');
      window.location.href = '/dashboard.html';
    }
  } catch (err) {
    console.error('Verification failed:', err);
    window.location.href = '/login.html';
  }
}

async function fetchAdminData() {
  await Promise.all([
    fetchStats(),
    fetchUsersList()
  ]);
}

async function fetchStats() {
  try {
    const res = await fetch('/api/admin/stats');
    if (!res.ok) throw new Error('Failed to load stats');
    const data = await res.json();

    document.getElementById('stat-users').textContent = data.total_users;
    document.getElementById('stat-links').textContent = data.total_links;
    document.getElementById('stat-views').textContent = data.total_views;
    document.getElementById('stat-clicks').textContent = data.total_clicks;
  } catch (err) {
    console.error('Error fetching admin stats:', err);
  }
}

async function fetchUsersList() {
  try {
    const res = await fetch('/api/admin/users');
    if (!res.ok) throw new Error('Failed to load users');
    const users = await res.json();

    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#718096; padding:2rem;">No user accounts found.</td></tr>';
      return;
    }

    users.forEach(user => {
      const tr = document.createElement('tr');
      
      const date = new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      // Show delete button only if it is not the current admin's own row
      const isSelf = user.role === 'admin'; 
      const actionHtml = isSelf 
        ? '<span style="color:#718096; font-size:0.85rem; font-style:italic;">Active Admin</span>'
        : `<button class="btn-delete-user" onclick="deleteUser(${user.id}, '${user.username}')">Delete Account</button>`;

      tr.innerHTML = `
        <td>${user.id}</td>
        <td>
          <a href="/${user.username}" target="_blank" style="color:#a855f7; font-weight:700;">@${user.username}</a>
        </td>
        <td>${user.email}</td>
        <td>
          <span class="badge-role ${user.role}">${user.role}</span>
        </td>
        <td>${user.links_count || 0}</td>
        <td>${user.views_count || 0}</td>
        <td>${date}</td>
        <td style="text-align: right;">
          ${actionHtml}
        </td>
      `;

      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading user accounts:', err);
  }
}

async function deleteUser(userId, username) {
  const confirmation = confirm(`⚠️ WARNING: Are you sure you want to permanently delete user @${username} and all of their links/analytics data? This action CANNOT be undone!`);
  if (!confirmation) return;

  try {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE'
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to delete user.');

    alert(data.message || 'User deleted successfully.');
    // Refresh admin data
    await fetchAdminData();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

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

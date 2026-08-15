const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('./db');
const { requireAuth, requireAdmin } = require('./auth');

// --- Helper: secure IP hashing for anonymized analytics ---
function getIpHash(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  return crypto.createHash('sha256').update(ip).digest('hex');
}

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

// Get public profile data (used by visitor pages)
router.get('/public/profile/:username', async (req, res) => {
  const username = req.params.username.toLowerCase().trim();

  try {
    // 1. Fetch user & profile
    const users = await db.query(
      `SELECT u.id, u.username, p.name, p.bio, p.avatar_url, p.theme_id, p.social_links 
       FROM users u
       JOIN profiles p ON u.id = p.user_id
       WHERE u.username = ?`,
      [username]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = users[0];
    // Parse social links if stored as string
    try {
      profile.social_links = typeof profile.social_links === 'string' ? JSON.parse(profile.social_links) : (profile.social_links || {});
    } catch (e) {
      profile.social_links = {};
    }

    // 2. Fetch active links sorted
    const links = await db.query(
      'SELECT id, title, url, sort_order FROM links WHERE user_id = ? AND is_active = 1 ORDER BY sort_order ASC, id DESC',
      [profile.id]
    );

    // 3. Record View event asynchronously
    const ipHash = getIpHash(req);
    const referrer = req.headers['referer'] || '';
    db.query(
      'INSERT INTO analytics (user_id, link_id, event_type, ip_hash, referrer) VALUES (?, NULL, "view", ?, ?)',
      [profile.id, ipHash, referrer]
    ).catch(err => console.error('Failed to log view analytics:', err));

    return res.json({ profile, links });
  } catch (error) {
    console.error('Public profile API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Record link click
router.post('/public/click/:linkId', async (req, res) => {
  const linkId = parseInt(req.params.linkId);

  try {
    // Verify link exists
    const links = await db.query('SELECT user_id FROM links WHERE id = ?', [linkId]);
    if (links.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const userId = links[0].user_id;
    const ipHash = getIpHash(req);
    const referrer = req.headers['referer'] || '';

    // Record Click event
    await db.query(
      'INSERT INTO analytics (user_id, link_id, event_type, ip_hash, referrer) VALUES (?, ?, "click", ?, ?)',
      [userId, linkId, 'click', ipHash, referrer]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Click analytics error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// SECURE USER ENDPOINTS (Require Authentication)
// ==========================================

// Get current user's profile info
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const profiles = await db.query(
      'SELECT name, bio, avatar_url, theme_id, social_links FROM profiles WHERE user_id = ?',
      [req.session.userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = profiles[0];
    try {
      profile.social_links = typeof profile.social_links === 'string' ? JSON.parse(profile.social_links) : (profile.social_links || {});
    } catch (e) {
      profile.social_links = {};
    }

    return res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Update profile info
router.post('/profile', requireAuth, async (req, res) => {
  const { name, bio, avatar_url, social_links } = req.body;

  try {
    const socialLinksStr = typeof social_links === 'object' ? JSON.stringify(social_links) : JSON.stringify({});

    await db.query(
      `UPDATE profiles 
       SET name = ?, bio = ?, avatar_url = ?, social_links = ? 
       WHERE user_id = ?`,
      [name || '', bio || '', avatar_url || '', socialLinksStr, req.session.userId]
    );

    return res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Update Theme
router.post('/theme', requireAuth, async (req, res) => {
  const { theme_id } = req.body;

  if (!theme_id) {
    return res.status(400).json({ error: 'theme_id is required' });
  }

  try {
    await db.query('UPDATE profiles SET theme_id = ? WHERE user_id = ?', [theme_id, req.session.userId]);
    return res.json({ success: true, message: 'Theme updated successfully.' });
  } catch (error) {
    console.error('Update theme error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get user's links list
router.get('/links', requireAuth, async (req, res) => {
  try {
    const links = await db.query(
      'SELECT id, title, url, sort_order, is_active FROM links WHERE user_id = ? ORDER BY sort_order ASC, id DESC',
      [req.session.userId]
    );
    return res.json(links);
  } catch (error) {
    console.error('Get links error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Create new link
router.post('/links', requireAuth, async (req, res) => {
  const { title, url } = req.body;

  if (!title || !url) {
    return res.status(400).json({ error: 'Title and URL are required.' });
  }

  try {
    // Find highest sort_order
    const maxOrderResult = await db.query(
      'SELECT MAX(sort_order) as max_order FROM links WHERE user_id = ?',
      [req.session.userId]
    );
    const nextOrder = (maxOrderResult[0].max_order || 0) + 1;

    const result = await db.query(
      'INSERT INTO links (user_id, title, url, sort_order, is_active) VALUES (?, ?, ?, ?, 1)',
      [req.session.userId, title, url, nextOrder]
    );

    return res.status(201).json({
      success: true,
      link: { id: result.insertId, title, url, sort_order: nextOrder, is_active: 1 }
    });
  } catch (error) {
    console.error('Create link error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Update Link
router.put('/links/:id', requireAuth, async (req, res) => {
  const linkId = parseInt(req.params.id);
  const { title, url, is_active } = req.body;

  try {
    // Verify ownership
    const linkCheck = await db.query('SELECT id FROM links WHERE id = ? AND user_id = ?', [linkId, req.session.userId]);
    if (linkCheck.length === 0) {
      return res.status(403).json({ error: 'Access denied or link not found.' });
    }

    await db.query(
      'UPDATE links SET title = ?, url = ?, is_active = ? WHERE id = ?',
      [title, url, is_active ? 1 : 0, linkId]
    );

    return res.json({ success: true, message: 'Link updated.' });
  } catch (error) {
    console.error('Update link error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Delete Link
router.delete('/links/:id', requireAuth, async (req, res) => {
  const linkId = parseInt(req.params.id);

  try {
    // Verify ownership
    const linkCheck = await db.query('SELECT id FROM links WHERE id = ? AND user_id = ?', [linkId, req.session.userId]);
    if (linkCheck.length === 0) {
      return res.status(403).json({ error: 'Access denied or link not found.' });
    }

    await db.query('DELETE FROM links WHERE id = ?', [linkId]);
    return res.json({ success: true, message: 'Link deleted.' });
  } catch (error) {
    console.error('Delete link error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Reorder Links
router.post('/links/reorder', requireAuth, async (req, res) => {
  const { orderedIds } = req.body; // Array of link IDs in order

  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: 'orderedIds must be an array.' });
  }

  try {
    // Bulk transaction update
    for (let i = 0; i < orderedIds.length; i++) {
      const linkId = orderedIds[i];
      await db.query(
        'UPDATE links SET sort_order = ? WHERE id = ? AND user_id = ?',
        [i, linkId, req.session.userId]
      );
    }

    return res.json({ success: true, message: 'Ordering saved successfully.' });
  } catch (error) {
    console.error('Reorder links error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get user's analytics
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    // 1. Total views & clicks
    const summary = await db.query(
      `SELECT 
        SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) as total_views,
        SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) as total_clicks
       FROM analytics 
       WHERE user_id = ?`,
      [userId]
    );

    // 2. Daily breakdown for the last 7 days (Views & Clicks)
    // We calculate dates dynamically to ensure timezone friendliness
    const dailyStats = await db.query(
      `SELECT 
        DATE_FORMAT(timestamp, '%Y-%m-%d') as event_date,
        SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) as views,
        SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) as clicks
       FROM analytics
       WHERE user_id = ? AND timestamp >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY event_date
       ORDER BY event_date ASC`,
      [userId]
    );

    // 3. Link-by-link click counts
    const linkBreakdown = await db.query(
      `SELECT l.id, l.title, l.url, COUNT(a.id) as clicks
       FROM links l
       LEFT JOIN analytics a ON l.id = a.link_id AND a.event_type = 'click'
       WHERE l.user_id = ?
       GROUP BY l.id, l.title, l.url
       ORDER BY clicks DESC`,
      [userId]
    );

    // 4. Top Referrers
    const referrers = await db.query(
      `SELECT referrer, COUNT(*) as count 
       FROM analytics 
       WHERE user_id = ? AND event_type = 'view' AND referrer != ''
       GROUP BY referrer 
       ORDER BY count DESC 
       LIMIT 5`,
      [userId]
    );

    return res.json({
      total_views: summary[0].total_views || 0,
      total_clicks: summary[0].total_clicks || 0,
      daily: dailyStats,
      links: linkBreakdown,
      referrers
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// ADMIN ENDPOINTS (Require Admin Authorization)
// ==========================================

// Get platform stats
router.get('/admin/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const usersCount = await db.query('SELECT COUNT(*) as count FROM users');
    const linksCount = await db.query('SELECT COUNT(*) as count FROM links');
    const viewsCount = await db.query('SELECT COUNT(*) as count FROM analytics WHERE event_type = "view"');
    const clicksCount = await db.query('SELECT COUNT(*) as count FROM analytics WHERE event_type = "click"');

    return res.json({
      total_users: usersCount[0].count,
      total_links: linksCount[0].count,
      total_views: viewsCount[0].count,
      total_clicks: clicksCount[0].count
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get user list
router.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.created_at,
              COUNT(DISTINCT l.id) as links_count,
              COUNT(DISTINCT CASE WHEN a.event_type = 'view' THEN a.id END) as views_count
       FROM users u
       LEFT JOIN links l ON u.id = l.user_id
       LEFT JOIN analytics a ON u.id = a.user_id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    return res.json(users);
  } catch (error) {
    console.error('Admin user list error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Delete user account
router.delete('/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const deleteUserId = parseInt(req.params.id);

  if (deleteUserId === req.session.userId) {
    return res.status(400).json({ error: 'Cannot delete your own admin account.' });
  }

  try {
    await db.query('DELETE FROM users WHERE id = ?', [deleteUserId]);
    return res.json({ success: true, message: 'User and all related pages deleted successfully.' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

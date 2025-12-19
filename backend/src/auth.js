export function requireAdmin(req, res, next) {
  // Simplified auth - accept default token or any non-empty token for dev
  const expected = process.env.ADMIN_TOKEN || 'changeme-admin-token';
  const actual = req.header('x-admin-token');
  
  // Accept if token matches OR if we're in dev mode (no strict ADMIN_TOKEN set)
  const isDevMode = !process.env.ADMIN_TOKEN;
  const tokenValid = actual && (actual === expected || (isDevMode && actual.length > 0));
  
  if (!tokenValid) {
    console.log('[AUTH FAIL] Expected:', expected, 'Got:', actual);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

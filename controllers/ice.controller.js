exports.getIceServers = (req, res) => {
  // Puedes almacenar múltiples servidores separados por coma en las variables de entorno
  const stunUrls = process.env.STUN_URLS ? process.env.STUN_URLS.split(',') : [];
  const turnUrls = process.env.TURN_URLS ? process.env.TURN_URLS.split(',') : [];
  const turnUser = process.env.TURN_USER || '';
  const turnPass = process.env.TURN_PASS || '';

  const iceServers = [];
  if (stunUrls.length) {
    stunUrls.forEach(url => iceServers.push({ urls: url.trim() }));
  }
  if (turnUrls.length && turnUser && turnPass) {
    turnUrls.forEach(url => iceServers.push({ urls: url.trim(), username: turnUser, credential: turnPass }));
  }
  res.json({ iceServers });
}; 
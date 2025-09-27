// Token store avanzado con soporte para:
// - Blacklist por token (legacy) y por jti
// - Registro de tokens activos (para endpoints admin)
// - Fallback memoria si Redis no está disponible

let redisClient = null;
let useRedis = false;
const memory = {
  blacklistToken: new Map(), // token -> expiry(ms)
  blacklistJti: new Map(),   // jti -> expiry(ms)
  active: new Map()          // jti -> { userId, exp, issuedAt, tokenVersion }
};

async function init() {
  if (process.env.REDIS_URL) {
    try {
      const Redis = require('ioredis');
      redisClient = new Redis(process.env.REDIS_URL);
      useRedis = true;
      redisClient.on('error', (e) => { console.warn('[tokenStore] Redis error', e.message); useRedis = false; });
    } catch (e) {
      console.warn('[tokenStore] No se pudo inicializar Redis, usando memoria local');
      useRedis = false;
    }
  }
}
init();

function ttlSecondsFromExp(expUnixSeconds){
  return Math.max(0, expUnixSeconds - Math.floor(Date.now()/1000));
}

function blacklistToken(token, expUnixSeconds){
  const ttl = ttlSecondsFromExp(expUnixSeconds);
  if (useRedis && redisClient) redisClient.set(`blacklist:token:${token}`, '1', 'EX', ttl || 1).catch(()=>{});
  else memory.blacklistToken.set(token, Date.now() + ttl * 1000);
}

function blacklistJti(jti, expUnixSeconds){
  const ttl = ttlSecondsFromExp(expUnixSeconds);
  if (useRedis && redisClient) redisClient.set(`blacklist:jti:${jti}`, '1', 'EX', ttl || 1).catch(()=>{});
  else memory.blacklistJti.set(jti, Date.now() + ttl * 1000);
}

async function isTokenBlacklisted(token){
  if (useRedis && redisClient) {
    try { return !!(await redisClient.get(`blacklist:token:${token}`)); } catch { return false; }
  }
  const exp = memory.blacklistToken.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { memory.blacklistToken.delete(token); return false; }
  return true;
}

async function isJtiBlacklisted(jti){
  if (useRedis && redisClient) {
    try { return !!(await redisClient.get(`blacklist:jti:${jti}`)); } catch { return false; }
  }
  const exp = memory.blacklistJti.get(jti);
  if (!exp) return false;
  if (Date.now() > exp) { memory.blacklistJti.delete(jti); return false; }
  return true;
}

function registerActiveToken({ jti, userId, exp, tokenVersion }) {
  const ttl = ttlSecondsFromExp(exp);
  if (useRedis && redisClient) {
    const key = `active:jti:${jti}`;
    const payload = JSON.stringify({ userId, exp, tokenVersion, issuedAt: Math.floor(Date.now()/1000) });
    redisClient.set(key, payload, 'EX', ttl || 1).catch(()=>{});
  } else {
    memory.active.set(jti, { userId, exp, tokenVersion, issuedAt: Math.floor(Date.now()/1000) });
  }
}

async function listActiveTokens(userId){
  const out = [];
  if (useRedis && redisClient) {
    // Escaneo simple (puede optimizarse con sets por usuario en futuras iteraciones)
    const stream = redisClient.scanStream({ match: 'active:jti:*', count: 100 });
    for await (const keys of stream) {
      if (!keys.length) continue;
      const vals = await redisClient.mget(keys);
      keys.forEach((k,i)=>{
        try {
          const data = JSON.parse(vals[i]);
          if (!userId || data.userId === userId) out.push({ jti: k.split(':').pop(), ...data });
        } catch(_){}
      });
    }
    return out;
  }
  for (const [jti, data] of memory.active.entries()) {
    if (Date.now()/1000 > data.exp) { memory.active.delete(jti); continue; }
    if (!userId || data.userId === userId) out.push({ jti, ...data });
  }
  return out;
}

function revokeActive(jti){
  if (useRedis && redisClient) redisClient.del(`active:jti:${jti}`).catch(()=>{});
  else memory.active.delete(jti);
}

module.exports = {
  // legacy compatibility
  add: blacklistToken,
  isBlacklisted: isTokenBlacklisted,
  // new API
  blacklistToken,
  blacklistJti,
  isTokenBlacklisted,
  isJtiBlacklisted,
  registerActiveToken,
  listActiveTokens,
  revokeActive,
  _memory: memory
};

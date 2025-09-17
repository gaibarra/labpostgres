// Token blacklist with Redis fallback to in-memory Map
let redisClient = null;
let useRedis = false;

async function init() {
  if (process.env.REDIS_URL) {
    try {
      const Redis = require('ioredis');
      redisClient = new Redis(process.env.REDIS_URL);
      useRedis = true;
      redisClient.on('error', (e) => { console.warn('Redis error', e.message); useRedis = false; });
    } catch (e) {
      console.warn('No se pudo inicializar Redis, usando memoria local');
      useRedis = false;
    }
  }
}
init();

const memory = new Map(); // token -> expiry(ms)

function add(token, expUnixSeconds) {
  const ttlSeconds = Math.max(0, expUnixSeconds - Math.floor(Date.now()/1000));
  if (useRedis && redisClient) {
    redisClient.set(`blacklist:${token}`, '1', 'EX', ttlSeconds || 1).catch(()=>{});
  } else {
    memory.set(token, Date.now() + ttlSeconds * 1000);
  }
}

async function isBlacklisted(token) {
  if (useRedis && redisClient) {
    try { return !!(await redisClient.get(`blacklist:${token}`)); } catch { return false; }
  }
  const exp = memory.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { memory.delete(token); return false; }
  return true;
}

module.exports = { add, isBlacklisted };

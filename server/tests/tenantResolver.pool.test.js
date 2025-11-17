const Module = require('module');

const tenantsData = new Map();

function buildMetricsMock() {
  return {
    incTenantPoolEviction: vi.fn(),
    incRevocation: vi.fn(),
    incVersionMismatch: vi.fn(),
    incJtiBlacklistHit: vi.fn(),
    metricsMiddleware: vi.fn(),
    metricsEndpoint: vi.fn()
  };
}

function buildPgMock() {
  return {
    Pool: class MockPool {
      constructor(opts = {}) {
        this.opts = opts;
        this.database = opts.database;
        this.kind = (opts.database || '').includes('lab_master') ? 'master' : 'tenant';
        this._ended = false;
        this.totalCount = 0;
        this.idleCount = 0;
        this.waitingCount = 0;
      }
      async query(sql, params) {
        if (this.kind === 'master' && /FROM\s+tenants/i.test(sql)) {
          const rec = tenantsData.get(params[0]);
          return { rows: rec ? [rec] : [] };
        }
        return { rows: [{ ok: 1 }] };
      }
      async connect() {
        return { release: vi.fn() };
      }
      async end() {
        this._ended = true;
      }
    }
  };
}

const tenantResolverPath = require.resolve('../services/tenantResolver');
const originalLoad = Module._load;

// Patch the loader so tenantResolver receives isolated pg/metrics mocks without touching production code.
beforeAll(() => {
  Module._load = function patchedLoader(request, parent, isMain) {
    if (request === 'pg' && parent?.id === tenantResolverPath) {
      return buildPgMock();
    }
    if (request === '../metrics' && parent?.id === tenantResolverPath) {
      return buildMetricsMock();
    }
    return originalLoad(request, parent, isMain);
  };
});

afterAll(() => {
  Module._load = originalLoad;
});

describe('tenantResolver pool eviction', () => {
  beforeEach(() => {
    tenantsData.clear();
    tenantsData.set('tenant-a', { id: 'tenant-a', slug: 'a', db_name: 'lab_a', status: 'active', db_version: 1 });
    tenantsData.set('tenant-b', { id: 'tenant-b', slug: 'b', db_name: 'lab_b', status: 'active', db_version: 1 });
    tenantsData.set('tenant-c', { id: 'tenant-c', slug: 'c', db_name: 'lab_c', status: 'active', db_version: 1 });
    process.env.TENANT_POOL_CACHE_MAX = '2';
    process.env.MASTER_PGDATABASE = 'lab_master';
    delete require.cache[tenantResolverPath];
  });

  afterEach(() => {
    delete process.env.TENANT_POOL_CACHE_MAX;
    delete process.env.MASTER_PGDATABASE;
    delete require.cache[tenantResolverPath];
  });

  it('evicts least recently used tenant pool when cache limit is exceeded', async () => {
    const resolver = require('../services/tenantResolver');
    const { getTenantPool, __getCache, getTenantPoolStats } = resolver;

    await getTenantPool('tenant-a');
    await getTenantPool('tenant-b');
    const cacheBefore = __getCache();
    expect(cacheBefore.size).toBe(2);
    const firstPool = cacheBefore.get('tenant-a').pool;
    expect(firstPool._ended).toBe(false);

    await getTenantPool('tenant-c');
    const cacheAfter = __getCache();
    expect(cacheAfter.size).toBe(2);
    expect(cacheAfter.has('tenant-c')).toBe(true);
    expect(cacheAfter.has('tenant-b')).toBe(true);
    expect(firstPool._ended).toBe(true);

    const stats = getTenantPoolStats();
    expect(stats.evictions).toBeGreaterThanOrEqual(1);
    expect(stats.evictionsByReason.lru).toBeGreaterThanOrEqual(1);
  });
});

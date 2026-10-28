import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * ADR-0008's Validation section, enforced rather than asserted.
 *
 * `DISC-006` found exactly one boundary violation in the system — Reviews
 * writing `Product.avgRating` and emitting `product.upserted` (KC-152) —
 * and `FEAT-RATING-OWNERSHIP` closed it. These tests are what stop it
 * coming back.
 *
 * A structural test rather than a behavioural one on purpose: the next
 * violation will not be a regression in Reviews, it will be a new module
 * doing the convenient thing. Only reading the source catches that.
 */

const SRC = join(__dirname, '..');
const CATALOG = join('modules', 'products');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    // Specs are excluded: a test may legitimately construct any call shape,
    // including the one being forbidden.
    return entry.endsWith('.ts') && !entry.endsWith('.spec.ts') ? [path] : [];
  });
}

const modules = sourceFiles(join(SRC, 'modules'));

describe('bounded-context boundaries (ADR-0008)', () => {
  it('finds source files to check — a silent empty sweep would pass forever', () => {
    expect(modules.length).toBeGreaterThan(20);
  });

  it('confines writes to the product row to Catalog', () => {
    const offenders = modules.filter(
      (file) =>
        !file.includes(CATALOG) && /\b(?:prisma|tx|client)\.product\.update\b/.test(readFileSync(file, 'utf8')),
    );

    // The aggregate must have a single owner, or nothing can guarantee it is
    // correct (KC-142). Command Catalog instead: `withRatingRecompute`.
    expect(offenders).toEqual([]);
  });

  it('confines product event emission to Catalog', () => {
    const offenders = modules.filter(
      (file) =>
        !file.includes(CATALOG) &&
        /emit\(\s*['"]product\.(?:upserted|deleted)['"]/.test(readFileSync(file, 'utf8')),
    );

    // A module publishing another context's event is half of KC-152. The name
    // `product.upserted` is only honest when Catalog is the one saying it.
    expect(offenders).toEqual([]);
  });

  it('keeps the rating derivation in one place', () => {
    // Three copies of an AVG/COUNT over reviews is how a seeded rating starts
    // disagreeing with a recomputed one (FEAT-RATING-OWNERSHIP §7.8).
    const offenders = sourceFiles(SRC).filter(
      (file) =>
        !file.endsWith('rating-aggregate.ts') &&
        /_avg:\s*\{\s*rating:\s*true/.test(readFileSync(file, 'utf8')),
    );

    expect(offenders).toEqual([]);
  });
});

/**
 * Law 5, generalised from Catalog to every context (ADR-0030 §F4, Proposal).
 *
 * `oriveda check boundaries` reads the import graph. Both of Law 5's vectors —
 * writing another context's table and emitting another context's event — go
 * through shared infrastructure (`PrismaService`, `EventBusService`), so an
 * import graph cannot see them. KC-152 was exactly that shape. These maps are
 * what can.
 *
 * The maps are closed: a new Prisma model, a new domain event or a new module
 * directory fails the build until someone assigns it an owner. Assigning one is
 * an architecture decision (ARCH-001 §1), and the failure is what forces it to
 * be made on purpose.
 *
 * Known limits, stated rather than hidden: nested writes
 * (`order.create({ data: { items: { create } } })`), raw SQL, and a delegate
 * reached through an alias (`const d = prisma.order; d.update(...)`) are not
 * attributed. Raw SQL is confined below instead.
 */

/**
 * Module directory → owning context. `shared` is ARCH-001 §1.2. Must equal
 * ARCH-001 §1.5 and every DOM-* §7 block's `paths` — the last describe block
 * below checks all three agree (ADR-0034).
 */
const MODULE_CONTEXT: Record<string, string> = {
  auth: 'identity',
  users: 'identity',
  products: 'catalog',
  collections: 'catalog',
  sizes: 'catalog',
  search: 'search',
  cart: 'shopping',
  wishlist: 'shopping',
  coupons: 'pricing',
  orders: 'ordering',
  payments: 'payments',
  inventory: 'inventory',
  returns: 'returns',
  reviews: 'reviews',
  qna: 'product-qa',
  recommendations: 'recommendation',
  cms: 'content',
  notifications: 'notification',
  analytics: 'reporting',
  shipping: 'shipping',
  'audit-log': 'shared',
  metrics: 'shared',
  storage: 'shared',
  uploads: 'shared',
  settings: 'shared',
  health: 'shared',
};

/** Prisma model → the one context allowed to write it (ARCH-001 §1.1). */
const TABLE_OWNER: Record<string, string> = {
  User: 'identity',
  OAuthAccount: 'identity',
  Address: 'identity',
  Category: 'catalog',
  Collection: 'catalog',
  CollectionProduct: 'catalog',
  Product: 'catalog',
  ProductVariant: 'catalog',
  ProductMedia: 'catalog',
  SizeOption: 'catalog',
  Inventory: 'inventory',
  Cart: 'shopping',
  CartItem: 'shopping',
  CartShare: 'shopping',
  CartShareItem: 'shopping',
  Wishlist: 'shopping',
  WishlistItem: 'shopping',
  Coupon: 'pricing',
  CouponRedemption: 'pricing',
  Order: 'ordering',
  OrderItem: 'ordering',
  OrderStatusHistory: 'ordering',
  Payment: 'payments',
  ReturnRequest: 'returns',
  ReturnStatusHistory: 'returns',
  Review: 'reviews',
  Question: 'product-qa',
  Answer: 'product-qa',
  QuestionUpvote: 'product-qa',
  AnswerUpvote: 'product-qa',
  ProductView: 'recommendation',
  ProductCoOccurrence: 'recommendation',
  Banner: 'content',
  Setting: 'shared',
  AuditLog: 'shared',
  PincodeServiceabilityOverride: 'shipping',
  Shipment: 'shipping',
  ShipmentStatusHistory: 'shipping',
};

/** Domain event → the one context allowed to emit it (ARCH-001 §3). */
const EVENT_OWNER: Record<string, string> = {
  'user.registered': 'identity',
  'order.confirmed': 'ordering',
  'payment.succeeded': 'payments',
  'return.requested': 'returns',
  'return.refunded': 'returns',
  'product.upserted': 'catalog',
  'product.deleted': 'catalog',
  'shipment.picked_up': 'shipping',
  'shipment.in_transit': 'shipping',
  'shipment.out_for_delivery': 'shipping',
  'shipment.delivered': 'shipping',
  'shipment.ndr_raised': 'shipping',
  'shipment.rto_initiated': 'shipping',
};

/** Modules allowed raw SQL writes, each for a stated reason. */
const RAW_WRITE_ALLOWED: Record<string, string> = {
  // Conditional-UPDATE reservation arithmetic (Law 4, KC-183), own table only.
  inventory: 'inventory',
};

const WRITE_OPS = 'create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany';
const delegate = (model: string): string => model.charAt(0).toLowerCase() + model.slice(1);
const moduleOf = (file: string): string => file.split(join(SRC, 'modules'))[1].split(/[\\/]/)[1];
const contextOf = (file: string): string => MODULE_CONTEXT[moduleOf(file)];

const schemaModels = [...readFileSync(join(SRC, 'prisma', 'schema.prisma'), 'utf8').matchAll(/^model\s+(\w+)\s*\{/gm)].map(
  (m) => m[1],
);
const eventNames = [
  ...readFileSync(join(SRC, 'common', 'event-bus', 'events.ts'), 'utf8')
    .split('export interface DomainEvents')[1]
    .matchAll(/'([a-z_]+\.[a-z_]+)'\s*:/g),
].map((m) => m[1]);

describe('bounded-context boundaries — every context (Law 5)', () => {
  it('reads a non-trivial schema and event catalogue — an empty sweep would pass forever', () => {
    expect(schemaModels.length).toBeGreaterThan(30);
    expect(eventNames.length).toBeGreaterThan(5);
  });

  it('assigns every module directory to a context or to shared infrastructure', () => {
    const dirs = readdirSync(join(SRC, 'modules')).filter((d) => statSync(join(SRC, 'modules', d)).isDirectory());
    expect(dirs.filter((d) => !MODULE_CONTEXT[d])).toEqual([]);
  });

  it('assigns every table an owner, and owns no table that does not exist', () => {
    expect(schemaModels.filter((m) => !TABLE_OWNER[m])).toEqual([]);
    expect(Object.keys(TABLE_OWNER).filter((m) => !schemaModels.includes(m))).toEqual([]);
  });

  it('assigns every domain event an owner, and owns no event that does not exist', () => {
    expect(eventNames.filter((e) => !EVENT_OWNER[e])).toEqual([]);
    expect(Object.keys(EVENT_OWNER).filter((e) => !eventNames.includes(e))).toEqual([]);
  });

  it('writes a table only from the context that owns it', () => {
    const offenders: string[] = [];
    for (const file of modules) {
      const src = readFileSync(file, 'utf8');
      for (const model of schemaModels) {
        const write = new RegExp(`\\.\\s*${delegate(model)}\\s*\\.\\s*(?:${WRITE_OPS})\\s*\\(`);
        if (write.test(src) && TABLE_OWNER[model] !== contextOf(file)) {
          offenders.push(`${moduleOf(file)} writes ${model} (owned by ${TABLE_OWNER[model]})`);
        }
      }
    }
    // Command the owning context instead (ADR-0008).
    expect(offenders).toEqual([]);
  });

  it('emits an event only from the context that owns it', () => {
    const offenders: string[] = [];
    for (const file of modules) {
      const src = readFileSync(file, 'utf8');
      if (!/\.emit\s*\(/.test(src)) continue;
      const ctx = contextOf(file);

      for (const m of src.matchAll(/\.emit\s*\(\s*['"`]([^'"`]+)['"`]/g)) {
        if (EVENT_OWNER[m[1]] !== ctx) offenders.push(`${moduleOf(file)} emits ${m[1]}`);
      }

      // An emit whose name is a variable (Shipping maps carrier statuses to
      // events) cannot be read directly. Bound it instead: such a file may
      // name, outside its own `.on(...)` subscriptions, only events its
      // context owns.
      if (/\.emit\s*\(\s*[^'"`\s]/.test(src)) {
        const subscribed = new Set([...src.matchAll(/\.on\s*\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]));
        for (const name of eventNames) {
          if (src.includes(`'${name}'`) && !subscribed.has(name) && EVENT_OWNER[name] !== ctx) {
            offenders.push(`${moduleOf(file)} names ${name} beside a dynamic emit`);
          }
        }
        if (!Object.values(EVENT_OWNER).includes(ctx)) offenders.push(`${moduleOf(file)} emits but owns no event`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps shared infrastructure and common/ free of any context (ADR-0031)', () => {
    // Shared services may be used by every context only because they depend
    // on none. The day one imports a context, that context becomes a
    // transitive dependency of everything — the implicit allowance stops
    // being safe.
    const commonFiles = sourceFiles(join(SRC, 'common'));
    const sharedFiles = modules.filter((f) => contextOf(f) === 'shared');
    const offenders: string[] = [];
    for (const file of [...sharedFiles, ...commonFiles]) {
      for (const m of readFileSync(file, 'utf8').matchAll(/from\s+['"](?:\.\.\/)+(?:modules\/)?([a-z-]+)\//g)) {
        const target = MODULE_CONTEXT[m[1]];
        if (target && target !== 'shared') offenders.push(`${file.replace(SRC, '')} imports ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('confines raw SQL writes to the modules allowed them', () => {
    const offenders = modules
      .filter((file) => /\$executeRaw(?:Unsafe)?\b/.test(readFileSync(file, 'utf8')))
      .map(moduleOf)
      .filter((mod) => !RAW_WRITE_ALLOWED[mod]);
    expect(offenders).toEqual([]);
  });
});

/**
 * ADR-0034: ARCH-001 §1.5's module map, this file's MODULE_CONTEXT and the
 * `paths` of every DOM-* §7 `oriveda-boundary` block are three statements of
 * one fact. `oriveda check boundaries` only sees modules that some block
 * owns — a module missing from every block is invisible to it — so the sync
 * is checked here, where a missing module already fails the build.
 */
const KNOWLEDGE = join(SRC, '..', '..', '..', 'knowledge');
const toDomain = (ctx: string): string => (ctx === 'shared' ? 'shared' : `DOM-${ctx.toUpperCase()}`);

function archModuleMap(): Record<string, string> {
  const arch = readFileSync(join(KNOWLEDGE, 'architecture', 'ARCH-001-system-architecture.md'), 'utf8');
  const section = arch.split('### 1.5 Module map')[1].split(/^#{2,3} /m)[0];
  const map: Record<string, string> = {};
  for (const row of section.matchAll(/^\|\s*(`[^|]+`)\s*\|\s*([^|]+?)\s*\|$/gm)) {
    const owner = row[2].startsWith('shared') ? 'shared' : row[2];
    for (const mod of row[1].matchAll(/`([a-z-]+)`/g)) map[mod[1]] = owner;
  }
  return map;
}

function boundaryBlocks(): Record<string, string[]> {
  const blocks: Record<string, string[]> = {};
  const dir = join(KNOWLEDGE, 'domains');
  for (const file of readdirSync(dir).filter((f) => /^DOM-.*\.md$/.test(f))) {
    const block = readFileSync(join(dir, file), 'utf8').match(/^```yaml oriveda-boundary\n([\s\S]*?)^```/m);
    if (!block) continue;
    const domain = block[1].match(/^domain:\s*(\S+)/m)![1];
    blocks[domain] = [...block[1].matchAll(/apps\/api\/src\/modules\/([a-z-]+)\/\*\*/g)].map((m) => m[1]).sort();
  }
  return blocks;
}

describe('module map agrees across ARCH-001 §1.5, this file and the DOM-* boundary blocks (ADR-0034)', () => {
  const expected: Record<string, string> = Object.fromEntries(
    Object.entries(MODULE_CONTEXT).map(([mod, ctx]) => [mod, toDomain(ctx)]),
  );

  it('ARCH-001 §1.5 maps every module exactly as MODULE_CONTEXT does', () => {
    expect(archModuleMap()).toEqual(expected);
  });

  it('every context has a boundary block whose paths are exactly its modules', () => {
    const byDomain: Record<string, string[]> = {};
    for (const [mod, dom] of Object.entries(expected)) {
      if (dom !== 'shared') (byDomain[dom] ??= []).push(mod);
    }
    for (const mods of Object.values(byDomain)) mods.sort();
    expect(boundaryBlocks()).toEqual(byDomain);
  });
});

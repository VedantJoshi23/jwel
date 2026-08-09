/**
 * FEAT-SETTINGS-STORE — the declared registry of admin-editable settings.
 *
 * Settings are a **closed set**, not free-form keys. A key that is not declared
 * here cannot be read or written: free-form keys are how a settings table
 * becomes a junk drawer nobody dares delete from.
 *
 * Every entry declares a **type, a default and a validation rule**, which does
 * three things a bare key/value table cannot:
 *
 * - reads are typed, so parsing does not get re-implemented (and mis-implemented)
 *   at every call site;
 * - reads never return null — an unset setting yields its default, so the
 *   system works before anyone has opened the admin page, including on the
 *   first request after a deploy;
 * - writes are refused with a message naming the constraint, rather than
 *   storing `"soon"` where a number belongs.
 *
 * The database cannot enforce any of this: one `value TEXT` column serves every
 * setting, because a typed column per setting would mean a migration per
 * setting. Per `STD-DATABASE` r6 that limitation is documented at the schema
 * with this module named as the enforcer.
 *
 * **Law 1**: every entry here must have a real consumer. A setting the admin UI
 * lists but nothing reads is a surface asserting a capability that does not
 * exist.
 */

export interface SettingDefinition<T> {
  /** Which domain owns the *meaning* of this key. Settings owns only the storage. */
  owner: string;
  description: string;
  default: T;
  /** Parses stored text. Throws if it cannot — callers fall back to the default. */
  parse: (raw: string) => T;
  serialise: (value: T) => string;
  /** Returns an error message, or null when the value is acceptable. */
  validate: (value: T) => string | null;
}

function positiveIntSetting(
  owner: string,
  description: string,
  defaultValue: number,
  max: number,
): SettingDefinition<number> {
  return {
    owner,
    description,
    default: defaultValue,
    parse: (raw) => {
      // Deliberately strict: Number('') is 0 and Number('5 days') is NaN, and
      // silently accepting either would put a wrong number into a customer-
      // facing rule.
      if (!/^-?\d+$/.test(raw.trim())) {
        throw new Error(`"${raw}" is not an integer`);
      }
      return Number.parseInt(raw.trim(), 10);
    },
    serialise: (value) => String(value),
    validate: (value) => {
      if (!Number.isInteger(value)) return 'must be a whole number';
      if (value < 1) return 'must be at least 1';
      if (value > max) return `must be at most ${max}`;
      return null;
    },
  };
}

/**
 * The registry.
 *
 * Keys are namespaced by owning domain so it stays obvious who decides what a
 * value means — `DOM-RETURNS` owns what `returns.window_days` *is*; this module
 * only holds it.
 */
export const SETTINGS = {
  'returns.window_days': positiveIntSetting(
    'DOM-RETURNS',
    'Days after delivery within which a customer may request a return. A single ' +
      'global value — not per product or per category (DOM-RETURNS Invariant 3).',
    10,
    // 365 is a guard against a typo, not a policy. An admin meaning 10 who
    // types 1000 should be stopped; an admin who genuinely wants a year-long
    // window can have one.
    365,
  ),
  'recommendations.min_co_occurrence': positiveIntSetting(
    'DOM-RECOMMENDATION',
    'How many times two products must have been bought together before the pair is ' +
      'recommendable. Below this the pair is treated as noise (Invariant 8).',
    5,
    // No sensible upper bound in principle — the guard is against a typo that
    // would silently empty every rail.
    1000,
  ),
} as const;

export type SettingKey = keyof typeof SETTINGS;

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS, key);
}

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

/** The declared type of a setting's value, for typed reads. */
export type SettingValue<K extends SettingKey> = (typeof SETTINGS)[K] extends SettingDefinition<
  infer T
>
  ? T
  : never;

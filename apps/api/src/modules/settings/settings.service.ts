import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  SETTING_KEYS,
  SETTINGS,
  SettingKey,
  SettingValue,
  isSettingKey,
} from './settings.registry';

export interface SettingView {
  key: SettingKey;
  value: unknown;
  default: unknown;
  description: string;
  owner: string;
  /** True when an admin has overridden the default. */
  overridden: boolean;
}

/**
 * FEAT-SETTINGS-STORE — read and write declared settings.
 *
 * Shared infrastructure, in the same category as AuditLogService: it owns the
 * storage, and each consuming domain owns the meaning of its own keys.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Typed read. Never returns null: an unset setting yields its declared
   * default, so the system works before anyone has opened the admin page.
   *
   * A stored value that no longer parses — because a registry type was
   * tightened after it was written — **falls back to the default and logs**,
   * rather than throwing. A malformed return window must not take down
   * returns for every customer (§7.3).
   */
  async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
    const definition = SETTINGS[key];
    const row = await this.prisma.setting.findUnique({ where: { key } });
    if (!row) return definition.default as SettingValue<K>;

    try {
      return definition.parse(row.value) as SettingValue<K>;
    } catch (error) {
      this.logger.error(
        `Setting "${key}" holds an unparseable value ${JSON.stringify(row.value)} — ` +
          `falling back to the default (${JSON.stringify(definition.default)}). ` +
          `Reason: ${(error as Error).message}`,
      );
      return definition.default as SettingValue<K>;
    }
  }

  /** Every declared setting with its effective value, for the admin surface. */
  async list(): Promise<SettingView[]> {
    const rows = await this.prisma.setting.findMany();
    const stored = new Map(rows.map((row) => [row.key, row.value]));

    return Promise.all(
      SETTING_KEYS.map(async (key) => ({
        key,
        value: await this.get(key),
        default: SETTINGS[key].default,
        description: SETTINGS[key].description,
        owner: SETTINGS[key].owner,
        overridden: stored.has(key),
      })),
    );
  }

  /**
   * Writes one setting.
   *
   * @throws NotFoundException for an undeclared key — never a silent insert,
   *   which is how a settings table becomes a junk drawer (§7.1).
   * @throws BadRequestException when the value fails its declared rule, with a
   *   message naming the constraint rather than "invalid".
   */
  async set(key: string, rawValue: unknown, actor: AuthenticatedUser): Promise<SettingView> {
    if (!isSettingKey(key)) {
      throw new NotFoundException(
        `Unknown setting "${key}". Declared settings: ${SETTING_KEYS.join(', ')}.`,
      );
    }

    const definition = SETTINGS[key];

    let parsed: unknown;
    try {
      parsed = typeof rawValue === 'string' ? definition.parse(rawValue) : rawValue;
    } catch (error) {
      throw new BadRequestException(`Cannot set "${key}": ${(error as Error).message}.`);
    }

    const problem = definition.validate(parsed as never);
    if (problem) {
      throw new BadRequestException(`Cannot set "${key}": it ${problem}.`);
    }

    // Read the effective value BEFORE writing, so the audit trail shows what
    // actually changed. On a first-time change that is the default, not null —
    // otherwise the entry cannot say what the value used to be (§7.7).
    const previous = await this.get(key);

    await this.prisma.setting.upsert({
      where: { key },
      update: { value: definition.serialise(parsed as never) },
      create: { key, value: definition.serialise(parsed as never) },
    });

    await this.auditLog.record({
      actor,
      action: 'settings.update',
      entityType: 'Setting',
      entityId: key,
      metadata: { from: previous, to: parsed },
    });

    return {
      key,
      value: parsed,
      default: definition.default,
      description: definition.description,
      owner: definition.owner,
      overridden: true,
    };
  }
}

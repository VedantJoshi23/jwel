import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SETTINGS, SETTING_KEYS } from './settings.registry';

const actor: AuthenticatedUser = { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };

/**
 * FEAT-SETTINGS-STORE §7 — every edge case has a test, per STD-TESTING r6.
 */
describe('SettingsService', () => {
  let prisma: {
    setting: { findUnique: jest.Mock; findMany: jest.Mock; upsert: jest.Mock };
  };
  let auditLog: { record: jest.Mock };
  let service: SettingsService;

  beforeEach(() => {
    prisma = {
      setting: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    };
    auditLog = { record: jest.fn() };
    service = new SettingsService(
      prisma as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
    );
  });

  describe('get', () => {
    it('returns the declared default when no row exists (§7.2)', async () => {
      // The system must work before anyone has opened the admin page.
      expect(await service.get('returns.window_days')).toBe(10);
      expect(SETTINGS['returns.window_days'].default).toBe(10);
    });

    it('returns the stored value, parsed to its declared type', async () => {
      prisma.setting.findUnique.mockResolvedValue({ key: 'returns.window_days', value: '21' });
      const value = await service.get('returns.window_days');
      expect(value).toBe(21);
      expect(typeof value).toBe('number');
    });

    it('falls back to the default — and logs — when a stored value will not parse (§7.3)', async () => {
      // A registry type tightened after a row was written. A malformed return
      // window must not take down returns for every customer.
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      prisma.setting.findUnique.mockResolvedValue({ key: 'returns.window_days', value: 'soon' });

      expect(await service.get('returns.window_days')).toBe(10);
      expect(logged).toHaveBeenCalledWith(expect.stringContaining('returns.window_days'));
      logged.mockRestore();
    });

    it('does not accept a value that merely starts with a number', async () => {
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      prisma.setting.findUnique.mockResolvedValue({ value: '5 days' });
      // Number('5 days') is NaN, but a laxer parse could yield 5. Neither is
      // acceptable silently.
      expect(await service.get('returns.window_days')).toBe(10);
      logged.mockRestore();
    });

    it('does not read an empty string as zero', async () => {
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      prisma.setting.findUnique.mockResolvedValue({ value: '' });
      expect(await service.get('returns.window_days')).toBe(10);
      logged.mockRestore();
    });
  });

  describe('list', () => {
    it('reports every declared setting with its default and overridden=false', async () => {
      const list = await service.list();
      expect(list).toContainEqual(
        expect.objectContaining({
          key: 'returns.window_days',
          value: 10,
          default: 10,
          owner: 'DOM-RETURNS',
          overridden: false,
        }),
      );
      expect(list).toContainEqual(
        expect.objectContaining({
          key: 'recommendations.min_co_occurrence',
          value: 5,
          default: 5,
          owner: 'DOM-RECOMMENDATION',
          overridden: false,
        }),
      );
      // Every declared setting, not a subset — a registry entry that never
      // reaches the admin page is a value nobody can tune.
      expect(list).toHaveLength(SETTING_KEYS.length);
    });

    it('marks a setting overridden once a row exists', async () => {
      prisma.setting.findMany.mockResolvedValue([{ key: 'returns.window_days', value: '15' }]);
      prisma.setting.findUnique.mockResolvedValue({ value: '15' });
      const [entry] = await service.list();
      expect(entry).toMatchObject({ value: 15, default: 10, overridden: true });
    });
  });

  describe('set', () => {
    it('stores a valid value and reports it back', async () => {
      const result = await service.set('returns.window_days', '14', actor);
      expect(prisma.setting.upsert).toHaveBeenCalledWith({
        where: { key: 'returns.window_days' },
        update: { value: '14' },
        create: { key: 'returns.window_days', value: '14' },
      });
      expect(result).toMatchObject({ value: 14, overridden: true });
    });

    it('accepts a native JSON number as well as a string', async () => {
      await service.set('returns.window_days', 14, actor);
      expect(prisma.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { value: '14' } }),
      );
    });

    it('404s on an unknown key rather than inserting it (§7.1)', async () => {
      await expect(service.set('nonsense', '1', actor)).rejects.toThrow(NotFoundException);
      expect(prisma.setting.upsert).not.toHaveBeenCalled();
    });

    it('names the declared keys in the 404, so the mistake is fixable', async () => {
      await expect(service.set('returns.windowDays', '1', actor)).rejects.toThrow(
        /returns\.window_days/,
      );
    });

    it('refuses a negative window with a message naming the constraint', async () => {
      await expect(service.set('returns.window_days', '-5', actor)).rejects.toThrow(
        /at least 1/,
      );
      expect(prisma.setting.upsert).not.toHaveBeenCalled();
    });

    it('refuses zero', async () => {
      await expect(service.set('returns.window_days', 0, actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses a non-numeric value', async () => {
      await expect(service.set('returns.window_days', 'soon', actor)).rejects.toThrow(
        /not an integer/,
      );
    });

    it('refuses a fractional value', async () => {
      await expect(service.set('returns.window_days', 2.5, actor)).rejects.toThrow(
        /whole number/,
      );
    });

    it('refuses an implausibly large window, guarding a typo', async () => {
      await expect(service.set('returns.window_days', 1000, actor)).rejects.toThrow(/at most 365/);
    });

    it('stores a value equal to the default rather than special-casing it (§7.5)', async () => {
      await service.set('returns.window_days', 10, actor);
      expect(prisma.setting.upsert).toHaveBeenCalled();
    });

    it('audit-logs the change with old and new values', async () => {
      prisma.setting.findUnique.mockResolvedValue({ value: '15' });
      await service.set('returns.window_days', 20, actor);
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actor,
          action: 'settings.update',
          entityType: 'Setting',
          entityId: 'returns.window_days',
          metadata: { from: 15, to: 20 },
        }),
      );
    });

    it('audits a first-time change against the default, not null (§7.7)', async () => {
      // Otherwise the trail cannot show what the value used to be.
      await service.set('returns.window_days', 20, actor);
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { from: 10, to: 20 } }),
      );
    });

    it('does not audit a refused write', async () => {
      await expect(service.set('returns.window_days', -1, actor)).rejects.toThrow();
      expect(auditLog.record).not.toHaveBeenCalled();
    });
  });

  describe('the registry itself', () => {
    it('declares a default that satisfies its own validation', () => {
      // A default the validator would reject is a setting nobody can save
      // back to its own default.
      for (const [key, definition] of Object.entries(SETTINGS)) {
        expect([key, definition.validate(definition.default as never)]).toEqual([key, null]);
      }
    });

    it('round-trips every default through serialise and parse', () => {
      for (const [key, definition] of Object.entries(SETTINGS)) {
        const raw = definition.serialise(definition.default as never);
        expect([key, definition.parse(raw)]).toEqual([key, definition.default]);
      }
    });
  });
});

import { SizeScheme } from '@prisma/client';
import { SizesController } from './sizes.controller';
import { SizesService } from './sizes.service';

describe('SizesController', () => {
  const options = [
    {
      scheme: SizeScheme.RING_INDIA,
      value: '16',
      label: '16',
      circumferenceMm: '56.30',
      diameterMm: '17.93',
      usEquivalent: '8',
      ukEquivalent: 'P½',
    },
  ];

  it('passes the scheme filter through to the service', async () => {
    const findAll = jest.fn().mockResolvedValue(options);
    const controller = new SizesController({ findAll } as unknown as SizesService);

    await expect(controller.findAll({ scheme: SizeScheme.RING_INDIA })).resolves.toEqual(options);
    expect(findAll).toHaveBeenCalledWith(SizeScheme.RING_INDIA);
  });

  it('passes undefined when no scheme is given', async () => {
    const findAll = jest.fn().mockResolvedValue(options);
    const controller = new SizesController({ findAll } as unknown as SizesService);

    await controller.findAll({});
    expect(findAll).toHaveBeenCalledWith(undefined);
  });
});

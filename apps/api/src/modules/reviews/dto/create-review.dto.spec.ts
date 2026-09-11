import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateReviewDto } from './create-review.dto';

const valid = { productId: 'p1', rating: 5, body: 'Beautiful finish.' };

async function fields(payload: Record<string, unknown>) {
  const errors = await validate(plainToInstance(CreateReviewDto, payload));
  return errors.map((e) => e.property);
}

describe('CreateReviewDto', () => {
  it('accepts a rated review with a body', async () => {
    expect(await fields(valid)).toEqual([]);
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
  ])('refuses an %s body', async (_why, body) => {
    // Regression: `@IsString()` alone accepted both, so an empty review could
    // be approved and count towards the rating with nothing to read.
    expect(await fields({ ...valid, body })).toContain('body');
  });

  it.each([0, 6, 3.5])('refuses a rating of %p', async (rating) => {
    expect(await fields({ ...valid, rating })).toContain('rating');
  });

  it('allows the title to be omitted', async () => {
    expect(await fields(valid)).toEqual([]);
  });

  it('refuses a title longer than the form allows', async () => {
    expect(await fields({ ...valid, title: 'x'.repeat(121) })).toContain('title');
  });

  it('trims the body and title rather than storing padding', async () => {
    const dto = plainToInstance(CreateReviewDto, { ...valid, body: '  Lovely.  ', title: ' Great ' });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ body: 'Lovely.', title: 'Great' });
  });
});

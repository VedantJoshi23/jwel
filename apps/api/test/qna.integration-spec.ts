import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import { cleanupTestUser, registerAndLogin, registerAndLoginAsAdmin, testPrisma, uniqueEmail } from './utils/auth-helpers';

describe('Product Q&A (integration)', () => {
  let app: INestApplication;
  const adminEmail = uniqueEmail('qna-admin');
  const customerEmail = uniqueEmail('qna-customer');
  let adminToken: string;
  let customerToken: string;
  let productId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await registerAndLoginAsAdmin(app, adminEmail)).token;
    customerToken = (await registerAndLogin(app, customerEmail)).token;

    const category = await testPrisma.category.upsert({
      where: { slug: 'integration-test-category' },
      create: { name: 'Integration Test Category', slug: 'integration-test-category' },
      update: {},
    });

    const product = await testPrisma.product.create({
      data: {
        name: 'Q&A Test Ring',
        slug: `qna-test-ring-${Date.now()}`,
        categoryId: category.id,
        description: 'A ring created for the Q&A integration spec.',
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cascades away every question/answer/upvote row created under it.
    await testPrisma.product.deleteMany({ where: { id: productId } });
    await cleanupTestUser(adminEmail);
    await cleanupTestUser(customerEmail);
    await app.close();
  });

  it('reads the question list with no Authorization header — 200, not 401', async () => {
    await request(app.getHttpServer()).get(`/api/v1/products/${productId}/questions`).expect(200);
  });

  it('rejects asking a question without a token', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/questions`)
      .send({ body: 'Does this tarnish?' })
      .expect(401);
  });

  it('rejects a whitespace-only question body', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/questions`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: '   ' })
      .expect(400);
  });

  it('a question is visible in the very next public read — no PENDING state', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/questions`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'Is this hypoallergenic?' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}/questions?pageSize=100`)
      .expect(200);

    expect(list.body.items.some((q: { id: string }) => q.id === created.body.id)).toBe(true);
  });

  it('a customer answer and an admin answer on the same question carry different isByStore values', async () => {
    const question = await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/questions`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'What is the band width?' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/questions/${question.body.id}/answers`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'I measured mine at 2mm.' })
      .expect(201);

    // Same route, no separate admin-answer endpoint — Invariant 6.
    await request(app.getHttpServer())
      .post(`/api/v1/questions/${question.body.id}/answers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'It is 3mm.' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}/questions?pageSize=100`)
      .expect(200);

    const found = list.body.items.find((q: { id: string }) => q.id === question.body.id);
    const byCustomer = found.answers.find((a: { body: string }) => a.body === 'I measured mine at 2mm.');
    const byAdmin = found.answers.find((a: { body: string }) => a.body === 'It is 3mm.');
    expect(byCustomer.isByStore).toBe(false);
    expect(byAdmin.isByStore).toBe(true);
  });

  it('a successful upvote returns 204 with an empty body, not a 200/201 the client would try to JSON-parse', async () => {
    // Regression for a real production bug: the route had no explicit
    // @HttpCode, so Nest sent a 200/201 with an empty body for a service
    // method that returns void. apps/web's apiFetch called response.json()
    // on any non-204 success, which threw on the empty body and surfaced as
    // "Could not update your upvote" even though this exact request had
    // already succeeded server-side.
    const question = await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/questions`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: '204-body fixture' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/questions/${question.body.id}/upvote`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(204);
    expect(res.body).toEqual({});
    expect(res.text).toBe('');

    const removeRes = await request(app.getHttpServer())
      .delete(`/api/v1/questions/${question.body.id}/upvote`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(204);
    expect(removeRes.text).toBe('');
  });

  it('removing an upvote that was never cast 404s', async () => {
    const question = await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/questions`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'Upvote-removal 404 fixture' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/questions/${question.body.id}/upvote`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(404);
  });

  it('the upvote toggle race resolves to exactly one upvote, never two', async () => {
    const question = await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/questions`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'Upvote race fixture' })
      .expect(201);

    await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post(`/api/v1/questions/${question.body.id}/upvote`)
          .set('Authorization', `Bearer ${customerToken}`),
      ),
    );

    // Both requests carry the same user/question pair, so regardless of
    // which one "won" the idempotent-check race, the unique constraint
    // guarantees the end state is exactly one row, never two.
    const rows = await testPrisma.questionUpvote.findMany({ where: { questionId: question.body.id } });
    expect(rows.length).toBe(1);
  });

  describe('admin routes — RBAC first', () => {
    it('a CUSTOMER cannot list admin questions', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/qa/questions')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('a CUSTOMER cannot moderate a question', async () => {
      const question = await request(app.getHttpServer())
        .post(`/api/v1/products/${productId}/questions`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ body: 'RBAC fixture' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/qa/questions/${question.body.id}/moderate`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ hidden: true })
        .expect(403);
    });

    it('a CUSTOMER cannot moderate an answer', async () => {
      const question = await request(app.getHttpServer())
        .post(`/api/v1/products/${productId}/questions`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ body: 'RBAC answer fixture' })
        .expect(201);
      const answer = await request(app.getHttpServer())
        .post(`/api/v1/questions/${question.body.id}/answers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'placeholder' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/qa/answers/${answer.body.id}/moderate`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ hidden: true })
        .expect(403);
    });
  });

  it('hiding a question takes down its whole thread; un-hiding restores it except an individually-hidden answer', async () => {
    const question = await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/questions`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'Cascade-hide fixture' })
      .expect(201);

    const keptAnswer = await request(app.getHttpServer())
      .post(`/api/v1/questions/${question.body.id}/answers`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'This one stays visible after unhide.' })
      .expect(201);

    const individuallyHiddenAnswer = await request(app.getHttpServer())
      .post(`/api/v1/questions/${question.body.id}/answers`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'This one was hidden on its own.' })
      .expect(201);

    // Hide one answer individually first.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/qa/answers/${individuallyHiddenAnswer.body.id}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ hidden: true })
      .expect(200);

    // Then hide the whole question.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/qa/questions/${question.body.id}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ hidden: true })
      .expect(200);

    const whileHidden = await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}/questions?pageSize=100`)
      .expect(200);
    expect(whileHidden.body.items.some((q: { id: string }) => q.id === question.body.id)).toBe(false);

    // Un-hide the question.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/qa/questions/${question.body.id}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ hidden: false })
      .expect(200);

    const afterUnhide = await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}/questions?pageSize=100`)
      .expect(200);
    const found = afterUnhide.body.items.find((q: { id: string }) => q.id === question.body.id);
    expect(found).toBeDefined();
    expect(found.answers.some((a: { id: string }) => a.id === keptAnswer.body.id)).toBe(true);
    expect(found.answers.some((a: { id: string }) => a.id === individuallyHiddenAnswer.body.id)).toBe(false);
  });

  it('unanswered=true excludes a question whose only answer is itself hidden — the row still exists', async () => {
    const zeroAnswers = await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/questions`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'Genuinely unanswered fixture' })
      .expect(201);

    const hiddenAnswerOnly = await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/questions`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'Has one hidden answer' })
      .expect(201);
    const answer = await request(app.getHttpServer())
      .post(`/api/v1/questions/${hiddenAnswerOnly.body.id}/answers`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'This gets hidden.' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/qa/answers/${answer.body.id}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ hidden: true })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/qa/questions?unanswered=true&pageSize=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const ids = list.body.items.map((q: { id: string }) => q.id);
    expect(ids).toContain(zeroAnswers.body.id);
    expect(ids).not.toContain(hiddenAnswerOnly.body.id);
  });

  it('the admin list includes product name/slug/image and the asker\'s email', async () => {
    const question = await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/questions`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'Admin-context fixture' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/qa/questions?pageSize=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const found = list.body.items.find((q: { id: string }) => q.id === question.body.id);
    expect(found.product).toMatchObject({ id: productId });
    expect(found.product.name).toBeTruthy();
    expect(found.product.slug).toBeTruthy();
    expect(found.user.email).toBe(customerEmail);
  });
});

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { UmlCommandBus, createUuid, type ProjectDocument } from '@examen-sw1/uml-core';

const apiUrl = 'http://127.0.0.1:3101';
const password = 'E2ePassword-123';

type Session = { accessToken: string };
type Resource = { project: ProjectDocument; storageVersion: number };

async function apiJson<T>(request: APIRequestContext, path: string, init: { method?: string; data?: unknown; token?: string } = {}): Promise<T> {
  const response = await request.fetch(`${apiUrl}${path}`, {
    method: init.method ?? 'GET',
    data: init.data,
    headers: init.token ? { authorization: `Bearer ${init.token}` } : undefined,
  });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<T>;
}

async function register(request: APIRequestContext, label: string): Promise<{ email: string; session: Session }> {
  const email = `${label}-${createUuid()}@e2e.test`;
  const session = await apiJson<Session>(request, '/auth/register', { method: 'POST', data: { email, password } });
  return { email, session };
}

async function createProject(request: APIRequestContext, session: Session, classes: string[] = []): Promise<Resource> {
  let resource = await apiJson<Resource>(request, '/projects', { method: 'POST', token: session.accessToken, data: { name: `Assistant ${createUuid()}` } });
  const bus = new UmlCommandBus();
  for (const name of classes) {
    const result = bus.execute(resource.project, { type: 'CreateClass', classId: createUuid(), name });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    resource = { ...resource, project: result.document };
  }
  if (classes.length > 0) {
    resource = await apiJson<Resource>(request, `/projects/${resource.project.id}/document`, {
      method: 'PUT',
      token: session.accessToken,
      data: { baseStorageVersion: resource.storageVersion, document: { revision: resource.project.revision, model: resource.project.model, layout: resource.project.layout } },
    });
  }
  return resource;
}

async function loginAndOpen(page: Page, email: string, projectId: string): Promise<void> {
  await page.goto(`/login?returnTo=${encodeURIComponent(`/editor?projectId=${projectId}`)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  const loginResponse = page.waitForResponse((response) => response.url() === `${apiUrl}/auth/login` && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in' }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page.getByTestId('editor-root')).toBeVisible();
}

async function login(page: Page, email: string, returnTo = '/'): Promise<void> {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  const loginResponse = page.waitForResponse((response) => response.url() === `${apiUrl}/auth/login` && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in' }).click();
  expect((await loginResponse).status()).toBe(200);
}

async function openAssistant(page: Page, prompt: string): Promise<void> {
  await page.getByRole('button', { name: 'Assist' }).click();
  await page.getByLabel('Describe a UML change').fill(prompt);
  await page.getByRole('button', { name: 'Generate preview' }).click();
}

test.describe('CASE UML assistant', () => {
  let consoleErrors: string[] = [];
  let pageErrors: string[] = [];
  let expectedConsoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    expectedConsoleErrors = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => pageErrors.push(error.message));
  });

  test.afterEach(() => {
    expect(consoleErrors).toEqual(expectedConsoleErrors);
    expect(pageErrors).toEqual([]);
  });

  test('reviews a create proposal before applying it once through the normal editor route', async ({ page, request }) => {
    const user = await register(request, 'create');
    const resource = await createProject(request, user.session);

    await loginAndOpen(page, user.email, resource.project.id);
    await openAssistant(page, 'create class Cliente');
    await expect(page.getByLabel('Assistant generation')).toContainText('Interpreting request...');
    expect(await page.getByRole('button', { name: 'Apply' }).count()).toBe(0);
    await expect(page.getByText('Review proposal')).toBeVisible();
    await expect(page.getByText('Cliente', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('Cliente', { exact: true })).toBeVisible();

    const current = await apiJson<Resource>(request, `/projects/${resource.project.id}`, { token: user.session.accessToken });
    expect(current.project.model.classes.filter((item) => item.name === 'Cliente')).toHaveLength(1);
  });

  test('cancels a delayed interpretation without changing the project', async ({ page, request }) => {
    const user = await register(request, 'cancel');
    const resource = await createProject(request, user.session);

    await loginAndOpen(page, user.email, resource.project.id);
    await openAssistant(page, 'delayed cancellable');
    await page.getByRole('button', { name: 'Cancel interpretation' }).click();
    await expect(page.getByText('Interpretation cancelled. The model was not applied.')).toBeVisible();

    const current = await apiJson<Resource>(request, `/projects/${resource.project.id}`, { token: user.session.accessToken });
    expect(current.project.model.classes).toHaveLength(0);
  });

  test('requires confirmation for a destructive proposal and preserves the fixture when preview is cancelled', async ({ page, request }) => {
    const user = await register(request, 'delete-cancel');
    const resource = await createProject(request, user.session, ['Fixture']);

    await loginAndOpen(page, user.email, resource.project.id);
    await openAssistant(page, 'delete fixture class');
    await expect(page.getByLabel('I confirm this destructive change.')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel preview' }).click();

    const current = await apiJson<Resource>(request, `/projects/${resource.project.id}`, { token: user.session.accessToken });
    expect(current.project.model.classes.map((item) => item.name)).toContain('Fixture');
  });

  test('applies a confirmed destructive proposal only after explicit confirmation', async ({ page, request }) => {
    const user = await register(request, 'delete-apply');
    const resource = await createProject(request, user.session, ['Fixture']);

    await loginAndOpen(page, user.email, resource.project.id);
    await openAssistant(page, 'delete fixture class');
    await page.getByLabel('I confirm this destructive change.').check();
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('Fixture', { exact: true })).toHaveCount(0);

    const current = await apiJson<Resource>(request, `/projects/${resource.project.id}`, { token: user.session.accessToken });
    expect(current.project.model.classes.map((item) => item.name)).not.toContain('Fixture');
  });

  test('returns ambiguity candidates without selecting or applying a target', async ({ page, request }) => {
    const user = await register(request, 'ambiguous');
    const resource = await createProject(request, user.session, ['Duplicada', 'Duplicada']);

    await loginAndOpen(page, user.email, resource.project.id);
    await openAssistant(page, 'ambiguity candidates');
    await expect(page.getByText('Choose a more specific target')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(0);

    const current = await apiJson<Resource>(request, `/projects/${resource.project.id}`, { token: user.session.accessToken });
    expect(current.project.model.classes.map((item) => item.name)).toEqual(['Duplicada', 'Duplicada']);
  });

  test('reports an invalid intent without mutation', async ({ page, request }) => {
    const user = await register(request, 'invalid');
    const resource = await createProject(request, user.session);

    await loginAndOpen(page, user.email, resource.project.id);
    await openAssistant(page, 'invalid intent');
    await expect(page.getByText('No safe change is ready to apply.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(0);

    const current = await apiJson<Resource>(request, `/projects/${resource.project.id}`, { token: user.session.accessToken });
    expect(current.project.model.classes).toHaveLength(0);
  });

  test('denies an unauthorized user without leaking a project or enabling apply', async ({ page, request }) => {
    const owner = await register(request, 'owner');
    const resource = await createProject(request, owner.session, ['Fixture']);
    const denied = await register(request, 'denied');
    const response = await request.post(`${apiUrl}/projects/${resource.project.id}/assistant/interpret`, {
      headers: { authorization: `Bearer ${denied.session.accessToken}` },
      data: { text: 'delete fixture class' },
    });
    expect(response.status()).toBe(404);
    expect(JSON.stringify(await response.json())).not.toContain('Fixture');

    expectedConsoleErrors = ['Failed to load resource: the server responded with a status of 404 (Not Found)'];
    await login(page, denied.email, `/editor?projectId=${resource.project.id}`);
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
    await expect(page.getByText('Fixture', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(0);
  });
});

import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { InvalidCredentialsError } from './auth.errors.js';
import { normalizeEmail, type UsersRepository } from './users.repository.js';

describe('authentication primitives', () => {
  it('normalizes emails and never exposes password hashes in registration results', async () => {
    const users = { create: vi.fn().mockResolvedValue({ id: 'f46b3d8e-e82a-4ff0-b2a4-8c62a66df2e3', email: 'person@example.com' }) } as unknown as UsersRepository;
    const service = new AuthService(users, new JwtService({ secret: 'test-secret-that-is-at-least-thirty-two-characters' }));
    expect(normalizeEmail(' Person@Example.COM ')).toBe('person@example.com');
    const response = await service.register(' Person@Example.COM ', 'password-with-eight-characters');
    expect(response.user).toEqual({ id: 'f46b3d8e-e82a-4ff0-b2a4-8c62a66df2e3', email: 'person@example.com' });
    expect(response).not.toHaveProperty('passwordHash');
    expect(users.create).toHaveBeenCalledWith(' Person@Example.COM ', expect.stringMatching(/^\$argon2id\$/));
  });

  it('uses the same credential error for unknown emails and incorrect passwords', async () => {
    const unknownUsers = { findByEmail: vi.fn().mockResolvedValue(null) } as unknown as UsersRepository;
    const wrongPasswordUsers = { findByEmail: vi.fn().mockResolvedValue({ id: 'f46b3d8e-e82a-4ff0-b2a4-8c62a66df2e3', email: 'person@example.com', passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$RG9Ob1RVU0VUaW5QYXNzd29yZA$KRd1HfY6xB81KVbW0l0w0Zl5bBZo4Mynoj8XPWDoJF8' }) } as unknown as UsersRepository;
    const jwt = new JwtService({ secret: 'test-secret-that-is-at-least-thirty-two-characters' });
    await expect(new AuthService(unknownUsers, jwt).login('unknown@example.com', 'password-with-eight-characters')).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(new AuthService(wrongPasswordUsers, jwt).login('person@example.com', 'wrong-password')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});

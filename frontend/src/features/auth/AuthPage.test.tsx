import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useAuthMock, loginMock, registerMock, navigateMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  loginMock: vi.fn(),
  registerMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('../../app/AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../services/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    error: string;

    constructor(status: number, error: string) {
      super(error);
      this.status = status;
      this.error = error;
    }
  },
  api: {
    auth: {
      login: loginMock,
      register: registerMock,
    },
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import { AuthPage } from './AuthPage';

function renderAuthPage(mode: 'login' | 'register') {
  return render(
    <MemoryRouter initialEntries={[mode === 'register' ? '/register' : '/login']}>
      <AuthPage mode={mode} />
    </MemoryRouter>,
  );
}

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthMock.mockReturnValue({
      flashMessage: null,
      clearFlashMessage: vi.fn(),
      signIn: vi.fn(),
    });
  });

  it('submits the registration flow and signs the user in', async () => {
    const signInMock = vi.fn();
    useAuthMock.mockReturnValue({
      flashMessage: null,
      clearFlashMessage: vi.fn(),
      signIn: signInMock,
    });
    registerMock.mockResolvedValue({
      user: { id: 1, username: 'alice', email: 'alice@example.com' },
      token: 'fresh-token',
    });

    renderAuthPage('register');

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
      });
    });
    expect(signInMock).toHaveBeenCalledWith({
      user: { id: 1, username: 'alice', email: 'alice@example.com' },
      token: 'fresh-token',
    });
    expect(navigateMock).toHaveBeenCalledWith('/documents', { replace: true });
  });

  it('shows backend login errors in the auth form', async () => {
    const { ApiError } = await import('../../services/api');
    loginMock.mockRejectedValue(new ApiError(401, 'Invalid credentials'));

    renderAuthPage('login');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'bad-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByText('Invalid credentials');
    expect(loginMock).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'bad-password',
    });
  });

  it('validates missing registration fields before submitting', async () => {
    renderAuthPage('register');

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Enter a username.')).toBeInTheDocument();
    expect(screen.getByText('Enter an email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter a password.')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });
});

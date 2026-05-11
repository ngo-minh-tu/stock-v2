'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { useAuth } from '@/contexts/AuthContext';

export function LoginForm() {
  const t = useTranslations('auth.login');
  const tBrand = useTranslations('app.brand');
  const { login } = useAuth();

  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(password);
    } catch {
      setError(t('error'));
      setSubmitting(false);
    }
  }

  return (
    <div
      className="card w-full max-w-sm p-8 flex flex-col gap-6"
      role="region"
      aria-labelledby="login-title"
    >
      <header className="flex flex-col gap-1 text-center">
        <span
          className="text-xs uppercase tracking-wider"
          style={{ color: 'var(--color-theme-crimson)' }}
        >
          {tBrand('name')}
        </span>
        <h1
          id="login-title"
          className="text-xl font-medium"
          style={{ color: 'var(--color-theme-text-tertiary)' }}
        >
          {t('title')}
        </h1>
        <p className="text-xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('subtitle')}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm">{t('passwordLabel')}</span>
          <Input
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            required
          />
        </label>

        {error && (
          <p
            className="text-xs"
            role="alert"
            style={{ color: 'var(--color-theme-crimson)' }}
          >
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting || password.length === 0}>
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </form>
    </div>
  );
}

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders heading and paragraph', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Token Price Analyzer' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Work in progress')).toBeInTheDocument();
  });
});

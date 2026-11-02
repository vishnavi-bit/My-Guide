/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../src/app/App';
import { buildTheme } from '../../src/styling/ChakraAppProvider';
import { chakraTokens } from '../../src/styling/tokens';

const at = ({ children }: { children?: React.ReactNode }) => <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>;
const routes = [{ id: 'home', path: '/', element: <p>Home page</p> }];

describe('app shell', () => {
  it('renders the header, the navigation and the content area around the page', () => {
    render(<App routes={routes} Router={at} />);
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('navigation', { hidden: true })).toBeTruthy();   // hidden at phone width until the menu opens
    expect(screen.getByRole('main').textContent).toContain('Home page');
  });

  it('the phone menu opens and closes from the header button, and the navigation follows it', () => {
    render(<App routes={routes} Router={at} />);
    const button = screen.getByRole('button', { name: 'Menu' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('navigation')).toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('navigation')).toBeTruthy();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('the menu button controls the navigation, which stays in the page so it can be opened at phone width', () => {
    render(<App routes={routes} Router={at} />);
    const nav = screen.getByRole('navigation', { hidden: true });
    expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-controls')).toBe(nav.id);
  });

  it('the breakpoints match the requirement: phone below 640px, tablet from 640px, desktop from 1024px', () => {
    const theme: any = buildTheme([{ id: 'chakra-styling', tokens: chakraTokens }]);
    expect(theme.breakpoints.sm).toBe('640px');
    expect(theme.breakpoints.md).toBe('1024px');
  });
});

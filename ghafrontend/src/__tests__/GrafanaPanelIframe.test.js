import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import GrafanaPanelIframe, { GRAFANA_IFRAME_STAGGER_MS } from '../components/GrafanaPanelIframe';

describe('GrafanaPanelIframe', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('staggerIndex 0 shows iframe immediately with src', () => {
    render(
      <GrafanaPanelIframe
        src="https://grafana.example.com/panel"
        staggerIndex={0}
        title="panel-0"
      />
    );

    const iframe = screen.getByTitle('panel-0');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://grafana.example.com/panel');
    expect(screen.queryByText('Loading panel…')).not.toBeInTheDocument();
  });

  test('staggerIndex 1 shows placeholder first, then iframe after delay', () => {
    render(
      <GrafanaPanelIframe
        src="https://grafana.example.com/panel"
        staggerIndex={1}
        title="panel-1"
      />
    );

    expect(screen.getByText('Loading panel…')).toBeInTheDocument();
    expect(screen.queryByTitle('panel-1')).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(GRAFANA_IFRAME_STAGGER_MS);
    });

    const iframe = screen.getByTitle('panel-1');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://grafana.example.com/panel');
    expect(screen.queryByText('Loading panel…')).not.toBeInTheDocument();
  });

  test('custom staggerMs is used for delayed panel', () => {
    const customDelay = 500;
    render(
      <GrafanaPanelIframe
        src="https://grafana.example.com/panel"
        staggerIndex={1}
        staggerMs={customDelay}
        title="panel-1"
      />
    );

    expect(screen.getByText('Loading panel…')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(customDelay - 1);
    });
    expect(screen.queryByTitle('panel-1')).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByTitle('panel-1')).toBeInTheDocument();
  });

  test('empty src with staggerIndex 0 shows placeholder', () => {
    render(
      <GrafanaPanelIframe src="" staggerIndex={0} title="empty" />
    );

    expect(screen.getByText('Loading panel…')).toBeInTheDocument();
  });
});

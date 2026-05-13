import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock react-slick BEFORE any imports that use it.
// react-slick's dependency (enquire.js) calls window.matchMedia.addListener()
// on module init, which crashes jsdom. Mocking the module avoids this entirely.
jest.mock('react-slick', () => {
  const Slider = ({ children }) => <div data-testid="mock-slider">{children}</div>;
  return Slider;
});

import PosterSlider from './PosterSlider.Component';

function setupComponent() {
  const { container } = render(
    <PosterSlider
      title="Popular Events"
      subtitle="Find your next plan"
      posters={[]}
      isDark
      isLoading={false}
    />,
  );

  return { container };
}

describe('PosterSlider', () => {
  it('renders title', () => {
    setupComponent();
    const titleElement = screen.getByText('Popular Events');
    expect(titleElement).toBeInTheDocument();
  });

  it('renders subtitle', async () => {
    setupComponent();
    const subtitleElement = screen.getByText('Find your next plan');
    expect(subtitleElement).toBeInTheDocument();
  });

  it('renders empty state when there are no posters', () => {
    setupComponent();
    const emptyStateElement = screen.getByText(
      'No events found in this category.',
    );
    expect(emptyStateElement).toBeInTheDocument();
  });
});

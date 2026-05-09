import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BookingModal from './BookingModal';
import { BrowserRouter } from 'react-router-dom';

// Mock EVERYTHING
vi.mock('../../context/DiscussionAuth.context', () => ({
  useAuth: () => ({ user: { _id: '123', name: 'Test User' }, isLoggedIn: true }),
}));

vi.mock('../../axios', () => ({
  backendAxios: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../utils/cloudinary', () => ({
  uploadToCloudinary: vi.fn(),
}));

vi.mock('../../utils/monitoring', () => ({
  reportSystemError: vi.fn(),
}));

// Mock headless UI fully
vi.mock('@headlessui/react', () => ({
  Dialog: ({ children, open }) => open ? <div data-testid="dialog">{children}</div> : null,
  Transition: ({ children, show }) => show ? <div data-testid="transition">{children}</div> : null,
  Fragment: ({ children }) => <>{children}</>,
}));

describe('BookingModal Smoke Test', () => {
  const mockEvent = {
    _id: 'event123',
    title: 'Nexus Alpha Launch',
    ticketPrice: 100,
    customForms: [],
  };

  it('renders without crashing', () => {
    render(
      <BrowserRouter>
        <BookingModal 
          isOpen={true} 
          setIsOpen={() => {}} 
          event={mockEvent} 
        />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/Nexus Alpha Launch/i)).toBeDefined();
  });
});

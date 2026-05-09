import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Attendees from './Attendees';
import { bookingService } from '../services/api';
import { useAuth } from '../hooks/useAuth';

// Mock the services and hooks
vi.mock('../services/api', () => ({
  bookingService: {
    getAllAttendees: vi.fn(),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('Attendees Page Smoke Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ admin: { role: 'superadmin' } });
    bookingService.getAllAttendees.mockResolvedValue({ data: [] });
  });

  it('renders without crashing', async () => {
    render(<Attendees />);
    
    // Check if the header is present
    const header = await screen.findByText(/Attendee/i);
    expect(header).toBeDefined();
  });

  it('displays the empty pool message when no data is returned', async () => {
    bookingService.getAllAttendees.mockResolvedValue({ data: [] });
    render(<Attendees />);
    
    const emptyMsg = await screen.findByText(/Identity Pool Empty/i);
    expect(emptyMsg).toBeDefined();
  });
});

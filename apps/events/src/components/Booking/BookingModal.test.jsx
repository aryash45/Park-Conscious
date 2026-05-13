// describe, it, expect are Jest globals via react-scripts - no import needed
// jest.mock replaces vi.mock in this environment

// 1. MOCK ALL HEAVY LIBRARIES to prevent OOM
// We mock them as empty objects/functions because we only care about 
// the component's internal logic and variable resolution for this smoke test.
jest.mock('lucide-react', () => ({
  X: () => null, CheckCircle2: () => null, AlertCircle: () => null,
  Loader2: () => null, CreditCard: () => null, User: () => null,
  Mail: () => null, Phone: () => null, ShieldCheck: () => null,
  Zap: () => null, FileText: () => null, ChevronDown: () => null,
  Briefcase: () => null,
  ExternalLink: () => null,
}));

jest.mock('@headlessui/react', () => ({
  Dialog: ({ children }) => children,
  Transition: ({ children }) => children,
  Fragment: ({ children }) => children,
}));

jest.mock('../../context/DiscussionAuth.context', () => ({
  useAuth: () => ({ user: {}, isLoggedIn: true }),
}));

jest.mock('../../axios', () => ({
  backendAxios: {},
}));

jest.mock('../../utils/cloudinary', () => ({
  uploadToCloudinary: () => {},
}));

jest.mock('../../utils/monitoring', () => ({
  reportSystemError: () => {},
}));

describe('BookingModal Integrity Test', () => {
  it('should be valid and all variables should be defined', async () => {
    // This dynamic import will fail if there are syntax errors or 
    // "Variable is not defined" errors during the transformation phase.
    const BookingModule = await import('./BookingModal');
    expect(BookingModule.default).toBeDefined();
  });
});

/**
 * apps/events/src/App.js
 *
 * Purpose: Main application component and routing hub for the Events platform.
 * Defines all public routes, dynamically lazy-loads page components,
 * and wraps the application in the global error boundary.
 */
import React, { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
// Triggering fresh SANGAM deployment build after quota reset.

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { Analytics } from "@vercel/analytics/react";
import AppErrorBoundary from "./components/AppErrorBoundary";

// Lazy load components
const HomePage = lazy(() => import("./pages/Home.Page"));
const ErrorPage = lazy(() => import("./pages/404"));
const CategoryPage = lazy(() => import("./pages/Category.Page"));
const DiscussionPage = lazy(() => import("./pages/Discussion.Page"));
const DiscussionListPage = lazy(() => import("./pages/DiscussionList.Page"));
const TedxTicketsPage = lazy(() => import("./pages/custom/TedxTickets.Page"));
const AfsanaPage = lazy(() => import("./pages/custom/Afsana.Page"));
const EventPage = lazy(() => import("./pages/Event.Page"));
const SuccessPage = lazy(() => import("./pages/Success.Page"));
const FailurePage = lazy(() => import("./pages/Failure.Page"));
const MyBookingsPage = lazy(() => import("./pages/MyBookings.Page"));
const AdminPage = lazy(() => import("./pages/Admin.Page"));
const HostPage = lazy(() => import("./pages/Host.Page"));
const SupportPage = lazy(() => import("./pages/Support.Page"));
const LegalPage = lazy(() => import("./pages/Legal.Page"));
const ListYourEventPage = lazy(() => import("./pages/ListYourEvent.Page"));
const PromoteEventPage = lazy(() => import("./pages/PromoteEvent.Page"));
const OrganizerDashboardPage = lazy(() => import("./pages/OrganizerDashboard.Page"));
const OrganizerSignupPage = lazy(() => import("./pages/OrganizerSignup.Page"));

// Minimalist Loading Fallback
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-[#050507]">
    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
  </div>
);

function App() {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/legal" element={<LegalPage />} />
          <Route path="/host" element={<ListYourEventPage />} />
          <Route path="/my-bookings" element={<MyBookingsPage />} />
          <Route path="/category/:id" element={<CategoryPage />} />
          <Route path="/discussion" element={<DiscussionListPage />} />
          <Route path="/discussion/:id" element={<DiscussionPage />} />
          <Route path="/tedx-tickets" element={<TedxTicketsPage />} />
          <Route path="/afsana-tickets" element={<AfsanaPage />} />
          <Route path="/event/:id" element={<EventPage />} />
          <Route path="/payment-success" element={<SuccessPage />} />
          <Route path="/payment-failure" element={<FailurePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/list-your-event" element={<ListYourEventPage />} />
          <Route path="/promote/:id" element={<PromoteEventPage />} />
          <Route path="/organizer/dashboard" element={<OrganizerDashboardPage />} />
          <Route path="/organizer/signup" element={<OrganizerSignupPage />} />
          <Route path="*" element={<ErrorPage />} />
        </Routes>
      </Suspense>
      <Analytics />
    </AppErrorBoundary>
  );
}

export default App;


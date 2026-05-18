import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './store';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Enquiries } from './pages/Enquiries';
import { NewEnquiry } from './pages/NewEnquiry';
import { Quotes } from './pages/Quotes';
import { NewQuote } from './pages/NewQuote';
import { Orders } from './pages/Orders';
import { NewOrder } from './pages/NewOrder';
import { Customers } from './pages/Customers';
import { NewCustomer } from './pages/NewCustomer';
import { Analytics } from './pages/Analytics';
import { Blueprint } from './pages/Blueprint';
import { Settings } from './pages/Settings';
import FollowUps from './pages/FollowUps';
import { Login } from './pages/Login';
import { SubmitPO } from './pages/SubmitPO';
import { IntelligenceBoard } from './pages/IntelligenceBoard';
import { useAppStore } from './store';
import { Loader2 } from 'lucide-react';

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAppStore();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="text-blk opacity-20 animate-spin" />
          <div className="font-mono text-[10px] font-bold tracking-[4px] uppercase text-blk opacity-50">Authorized Access Only</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public route — no auth required */}
          <Route path="/submit-po/:quoteId" element={<SubmitPO />} />

          {/* All other routes require auth */}
          <Route path="/*" element={
            <AuthWrapper>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="enquiries" element={<Enquiries />} />
                  <Route path="enquiries/new" element={<NewEnquiry />} />
                  <Route path="quotes" element={<Quotes />} />
                  <Route path="quotes/new" element={<NewQuote />} />
                  <Route path="orders" element={<Orders />} />
                  <Route path="orders/new" element={<NewOrder />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="customers/new" element={<NewCustomer />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="blueprint" element={<Blueprint />} />
                  <Route path="followups" element={<FollowUps />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="intelligence" element={<IntelligenceBoard />} />
                  <Route path="*" element={<div className="p-8 text-[13px] font-mono">Module not found...</div>} />
                </Route>
              </Routes>
            </AuthWrapper>
          } />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
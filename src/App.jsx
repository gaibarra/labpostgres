import React from 'react';
    import { Routes, Route, Navigate } from 'react-router-dom';
    import Layout from '@/components/Layout';
    import DashboardPage from '@/pages/DashboardPage';
    import LoginPage from '@/pages/LoginPage';
    import SignUpPage from '@/pages/SignUpPage';
    import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
    import ResetPasswordPage from '@/pages/ResetPasswordPage';
    import ProtectedRoute from '@/components/ProtectedRoute';
    import ProfilePage from '@/pages/ProfilePage';
    import AIRecommendationsPrint from '@/components/modules/orders/AIRecommendationsPrint';
    import OrderLabelsPrint from '@/components/modules/orders/OrderLabelsPrint';

    import Patients from '@/components/modules/patients/Patients';
    import ClinicalHistory from '@/components/modules/patients/ClinicalHistory';
    import Referrers from '@/components/modules/Referrers';
    import Studies from '@/components/modules/Studies';
    import Packages from '@/components/modules/Packages';
    import Orders from '@/components/modules/Orders';
    import Administration from '@/components/modules/Administration';
    import UserManagement from '@/components/modules/administration/UserManagement'; 
    import RolesAndPermissions from '@/components/modules/administration/RolesAndPermissions';
    import SystemAuditLog from '@/components/modules/administration/SystemAuditLog';
    import GeneralSettings from '@/components/modules/administration/GeneralSettings';
    import BranchManagement from '@/components/modules/administration/BranchManagement';
    import Finance from '@/components/modules/Finance';
    import Marketing from '@/components/modules/Marketing';
    import AdCampaigns from '@/components/modules/marketing/AdCampaigns';
    import SocialMediaManagement from '@/components/modules/marketing/SocialMediaManagement';
    import EmailMarketing from '@/components/modules/marketing/EmailMarketing';
    import SeoAndContent from '@/components/modules/marketing/SeoAndContent';
    import AnalyticsAndKPIs from '@/components/modules/marketing/AnalyticsAndKPIs';
    import LoyaltyPrograms from '@/components/modules/marketing/LoyaltyPrograms';
    import IncomeReport from '@/components/modules/finance/IncomeReport';
    import ExpenseTracking from '@/components/modules/finance/ExpenseTracking';
    import AccountsReceivable from '@/components/modules/finance/AccountsReceivable';
    import InvoicingAndReceipts from '@/components/modules/finance/InvoicingAndReceipts';
    import TaxConfiguration from '@/components/modules/finance/TaxConfiguration';
    import CashFlow from '@/components/modules/finance/CashFlow';
    import BillingReport from '@/components/modules/finance/BillingReport';
    import { Toaster } from 'sonner';
import { SidebarProvider } from '@/contexts/SidebarContext';
import ManualPreviewPage from '@/pages/ManualPreviewPage';
import UserManualContent from '@/components/UserManualContent';
// ...existing code...

function App() {
  return (
    <SidebarProvider>
      <Toaster richColors theme="system" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/print/ai-recommendations/:orderId" element={<ProtectedRoute><AIRecommendationsPrint /></ProtectedRoute>} />
            <Route path="/print/order-labels/:orderId" element={<ProtectedRoute><OrderLabelsPrint /></ProtectedRoute>} />
            <Route path="/manual-preview" element={<ProtectedRoute><ManualPreviewPage><UserManualContent /></ManualPreviewPage></ProtectedRoute>} />
            <Route 
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<Navigate to="/administration/general-settings" replace />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/patients/:patientId/history" element={<ClinicalHistory />} />
              <Route path="/referrers" element={<Referrers />} />
              <Route path="/studies" element={<Studies />} />
              <Route path="/packages" element={<Packages />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/administration" element={<Administration />} />
              <Route path="/administration/user-management" element={<UserManagement />} />
              <Route path="/administration/roles-permissions" element={<RolesAndPermissions />} />
              <Route path="/administration/audit-log" element={<SystemAuditLog />} />
              <Route path="/administration/general-settings" element={<GeneralSettings />} />
              <Route path="/administration/branch-management" element={<BranchManagement />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/finance/income-report" element={<IncomeReport />} />
              <Route path="/finance/expense-tracking" element={<ExpenseTracking />} />
              <Route path="/finance/accounts-receivable" element={<AccountsReceivable />} />
              <Route path="/finance/invoicing-receipts" element={<InvoicingAndReceipts />} />
              <Route path="/finance/tax-configuration" element={<TaxConfiguration />} />
              <Route path="/finance/cash-flow" element={<CashFlow />} />
              <Route path="/finance/billing-report" element={<BillingReport />} />
              <Route path="/marketing" element={<Marketing />} />
              <Route path="/marketing/ad-campaigns" element={<AdCampaigns />} />
              <Route path="/marketing/social-media" element={<SocialMediaManagement />} />
              <Route path="/marketing/email-marketing" element={<EmailMarketing />} />
              <Route path="/marketing/seo-content" element={<SeoAndContent />} />
              <Route path="/marketing/analytics-kpis" element={<AnalyticsAndKPIs />} />
              <Route path="/marketing/loyalty-programs" element={<LoyaltyPrograms />} />
              // ...existing code...
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </SidebarProvider>
      );
    }

    export default App;
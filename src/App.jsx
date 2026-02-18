import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Toaster } from 'sonner';
import { SidebarProvider } from '@/contexts/SidebarContext';
import UserManualContent from '@/components/UserManualContent';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const SignUpPage = lazy(() => import('@/pages/SignUpPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const ManualPreviewPage = lazy(() => import('@/pages/ManualPreviewPage'));

const AIRecommendationsPrint = lazy(() => import('@/components/modules/orders/AIRecommendationsPrint'));
const OrderLabelsPrint = lazy(() => import('@/components/modules/orders/OrderLabelsPrint'));
const Patients = lazy(() => import('@/components/modules/patients/Patients'));
const ClinicalHistory = lazy(() => import('@/components/modules/patients/ClinicalHistory'));
const Referrers = lazy(() => import('@/components/modules/Referrers'));
const Studies = lazy(() => import('@/components/modules/Studies'));
const Packages = lazy(() => import('@/components/modules/Packages'));
const Orders = lazy(() => import('@/components/modules/Orders'));
const Quotes = lazy(() => import('@/components/modules/Quotes'));
const Administration = lazy(() => import('@/components/modules/Administration'));
const UserManagement = lazy(() => import('@/components/modules/administration/UserManagement'));
const RolesAndPermissions = lazy(() => import('@/components/modules/administration/RolesAndPermissions'));
const SystemAuditLog = lazy(() => import('@/components/modules/administration/SystemAuditLog'));
const GeneralSettings = lazy(() => import('@/components/modules/administration/GeneralSettings'));
const BranchManagement = lazy(() => import('@/components/modules/administration/BranchManagement'));
const Finance = lazy(() => import('@/components/modules/Finance'));
const Marketing = lazy(() => import('@/components/modules/Marketing'));
const AdCampaigns = lazy(() => import('@/components/modules/marketing/AdCampaigns'));
const SocialMediaManagement = lazy(() => import('@/components/modules/marketing/SocialMediaManagement'));
const EmailMarketing = lazy(() => import('@/components/modules/marketing/EmailMarketing'));
const SeoAndContent = lazy(() => import('@/components/modules/marketing/SeoAndContent'));
const AnalyticsAndKPIs = lazy(() => import('@/components/modules/marketing/AnalyticsAndKPIs'));
const LoyaltyPrograms = lazy(() => import('@/components/modules/marketing/LoyaltyPrograms'));
const IncomeReport = lazy(() => import('@/components/modules/finance/IncomeReport'));
const ExpenseTracking = lazy(() => import('@/components/modules/finance/ExpenseTracking'));
const AccountsReceivable = lazy(() => import('@/components/modules/finance/AccountsReceivable'));
const InvoicingAndReceipts = lazy(() => import('@/components/modules/finance/InvoicingAndReceipts'));
const TaxConfiguration = lazy(() => import('@/components/modules/finance/TaxConfiguration'));
const CashFlow = lazy(() => import('@/components/modules/finance/CashFlow'));
const BillingReport = lazy(() => import('@/components/modules/finance/BillingReport'));

const RouteFallback = () => (
  <div className="flex h-screen w-full items-center justify-center bg-background text-muted-foreground">
    Cargando módulo...
  </div>
);

function App() {
  return (
    <SidebarProvider>
      <Toaster richColors theme="system" />
      <Suspense fallback={<RouteFallback />}>
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
            <Route path="/quotes" element={<Quotes />} />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </SidebarProvider>
  );
}

export default App;
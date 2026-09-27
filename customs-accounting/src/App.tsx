import { Suspense, lazy } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LanguageProvider, useLanguage } from "@/lib/language-context";
import { CompanySettingsProvider } from "@/lib/company-settings-context";
import { DisplaySettingsProvider } from "@/lib/display-settings-context";
const CustomerLedgerPrintPage = lazy(() => import("@/pages/customer-ledger/print"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Layout
import AppLayout from "./components/layout/AppLayout";

// Pages
const LoginPage = lazy(() => import("./pages/login"));
const Dashboard = lazy(() => import("./pages/dashboard"));
const ClientsList = lazy(() => import("./pages/clients/index"));
const ClientDetail = lazy(() => import("./pages/clients/detail"));
const ClientStatement = lazy(() => import("./pages/clients/statement"));
const InvoicesList = lazy(() => import("./pages/invoices/index"));
const InvoiceForm = lazy(() => import("./pages/invoices/form"));
const InvoiceReceipt = lazy(() => import("./pages/invoices/receipt"));
const TemplatesList = lazy(() => import("./pages/templates/index"));
const StatementsIndex = lazy(() => import("./pages/statements/index"));
const ReceiptsList = lazy(() => import("./pages/receipts/index"));
const ReceiptForm = lazy(() => import("./pages/receipts/form"));
const ReceiptPrint = lazy(() => import("./pages/receipts/print"));
const UsersPage = lazy(() => import("./pages/users/index"));
const TrashPage = lazy(() => import("./pages/trash/index"));
const AccountingPage = lazy(() => import("./pages/accounting/index"));
const SettingsPage = lazy(() => import("./pages/settings/index"));
const DeveloperSettingsPage = lazy(() => import("./pages/settings/developer"));
const CustomerLedgerPage = lazy(() => import("./pages/customer-ledger"));

const queryClient = new QueryClient();
const DEVELOPER_FRONTEND_ALLOWED_ROUTES = [
  "/settings/developer",
  "/settings",
  "/users-management",
];

function isExternalPrintRoute(location: string) {
  const pathname = location.split("?")[0];

  return (
    /^\/clients\/[^/]+\/statement$/.test(pathname) ||
    /^\/invoices\/[^/]+\/receipt$/.test(pathname) ||
    /^\/receipts\/[^/]+\/print$/.test(pathname) ||
    pathname === "/customer-ledger/print"
  );
}

function RouteWrapper({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

function PrintRoutes() {
  const [location] = useLocation();
  const pathname = location.split("?")[0];

  return (
    <Switch location={pathname}>
      <Route path="/clients/:id/statement" component={ClientStatement} />
      <Route path="/invoices/:id/receipt" component={InvoiceReceipt} />
      <Route path="/receipts/:id/print" component={ReceiptPrint} />
      <Route path="/customer-ledger/print" component={CustomerLedgerPrintPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ProtectedRouter() {
  const { user, isLoading } = useAuth();
  const { lang } = useLanguage();
  const [location] = useLocation();
  const isAR = lang === "ar";
  const isDeveloperFrontendOnly =
    sessionStorage.getItem("developer_entry_from_login") === "true" &&
    !sessionStorage.getItem("auth_token");
  const isDeveloperFrontendAllowedRoute = DEVELOPER_FRONTEND_ALLOWED_ROUTES.some(
    (route) => location === route || location.startsWith(`${route}/`)
  );
  const isExternalPrintMode =
    window.name === "external-print-window" && isExternalPrintRoute(location);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir={isAR ? "rtl" : "ltr"}>
        <div className="text-muted-foreground text-lg">{isAR ? "جارٍ التحميل..." : "Loading..."}</div>
      </div>
    );
  }

  if (!user || (isDeveloperFrontendOnly && !isDeveloperFrontendAllowedRoute)) {
    return <LoginPage />;
  }

  if (isExternalPrintMode) {
    return <PrintRoutes />;
  }

  return (
    <RouteWrapper>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/clients" component={ClientsList} />
        <Route path="/clients/:id" component={ClientDetail} />
        <Route path="/clients/:id/statement" component={ClientStatement} />
        <Route path="/invoices" component={InvoicesList} />
        <Route path="/invoices/new" component={InvoiceForm} />
        <Route path="/invoices/:id/edit" component={InvoiceForm} />
        <Route path="/invoices/:id/receipt" component={InvoiceReceipt} />
        <Route path="/statements" component={StatementsIndex} />
        <Route path="/receipts" component={ReceiptsList} />
        <Route path="/receipts/new" component={ReceiptForm} />
        <Route path="/receipts/:id/edit" component={ReceiptForm} />
        <Route path="/receipts/:id/print" component={ReceiptPrint} />
        <Route path="/templates" component={TemplatesList} />
        <Route path="/users" component={UsersPage} />
        <Route path="/users-management" component={UsersPage} />
        <Route path="/accounting" component={AccountingPage} />
        <Route path="/trash" component={TrashPage} />
        <Route path="/dev" component={DeveloperSettingsPage} />
        <Route path="/settings/developer" component={DeveloperSettingsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/customer-ledger" component={CustomerLedgerPage} />
        <Route path="/customer-ledger/print" component={CustomerLedgerPrintPage} />
        <Route component={NotFound} />
      </Switch>
    </RouteWrapper>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <AuthProvider>
            <CompanySettingsProvider>
              <DisplaySettingsProvider>
                <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">جارٍ التحميل...</div>}>
                  <ProtectedRouter />
                </Suspense>
              </DisplaySettingsProvider>
            </CompanySettingsProvider>
          </AuthProvider>
          <Toaster />
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

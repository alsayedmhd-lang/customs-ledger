import { Switch, Route, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LanguageProvider, useLanguage } from "@/lib/language-context";
import { CompanySettingsProvider } from "@/lib/company-settings-context";
import { DisplaySettingsProvider } from "@/lib/display-settings-context";
import CustomerLedgerPrintPage from "@/pages/customer-ledger/print";
import NotFound from "@/pages/not-found";

// Layout
import AppLayout from "./components/layout/AppLayout";

// Pages
import LoginPage from "./pages/login";
import Dashboard from "./pages/dashboard";
import ClientsList from "./pages/clients/index";
import ClientDetail from "./pages/clients/detail";
import ClientStatement from "./pages/clients/statement";
import InvoicesList from "./pages/invoices/index";
import InvoiceForm from "./pages/invoices/form";
import InvoiceReceipt from "./pages/invoices/receipt";
import TemplatesList from "./pages/templates/index";
import StatementsIndex from "./pages/statements/index";
import ReceiptsList from "./pages/receipts/index";
import ReceiptForm from "./pages/receipts/form";
import ReceiptPrint from "./pages/receipts/print";
import UsersPage from "./pages/users/index";
import TrashPage from "./pages/trash/index";
import AccountingPage from "./pages/accounting/index";
import SettingsPage from "./pages/settings/index";
import DeveloperSettingsPage from "./pages/settings/developer";
import CustomerLedgerPage from "./pages/customer-ledger";

const queryClient = new QueryClient();
const DEVELOPER_FRONTEND_ALLOWED_ROUTES = [
  "/settings/developer",
  "/settings",
  "/users-management",
];

function isExternalPrintRoute(location: string) {
  return (
    /^\/invoices\/[^/]+\/receipt$/.test(location) ||
    /^\/receipts\/[^/]+\/print$/.test(location) ||
    location === "/customer-ledger/print"
  );
}

function RouteWrapper({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

function PrintRoutes() {
  return (
    <Switch>
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
                <ProtectedRouter />
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

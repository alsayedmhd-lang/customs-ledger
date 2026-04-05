import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LanguageProvider } from "@/lib/language-context";
import { CompanySettingsProvider } from "@/lib/company-settings-context";
import { DisplaySettingsProvider } from "@/lib/display-settings-context";
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

const queryClient = new QueryClient();

function RouteWrapper({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isPrintRoute = location.endsWith('/statement') || location.endsWith('/receipt') || location.endsWith('/print');
  if (isPrintRoute) return <>{children}</>;
  return <AppLayout>{children}</AppLayout>;
}

function ProtectedRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="text-muted-foreground text-lg">جارٍ التحميل...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
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
        <Route path="/accounting" component={AccountingPage} />
        <Route path="/trash" component={TrashPage} />
        <Route path="/settings" component={SettingsPage} />
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
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <ProtectedRouter />
                </WouterRouter>
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

import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import App from "./App";
import "./index.css";

import { AuthProvider } from "@/lib/auth-context";
import { LanguageProvider } from "@/lib/language-context";
import { CompanySettingsProvider } from "@/lib/company-settings-context";
import { DisplaySettingsProvider } from "@/lib/display-settings-context";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <Router hook={useHashLocation}>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <CompanySettingsProvider>
            <DisplaySettingsProvider>
              <App />
            </DisplaySettingsProvider>
          </CompanySettingsProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </Router>
);
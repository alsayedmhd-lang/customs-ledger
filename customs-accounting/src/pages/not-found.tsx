import { Link } from "wouter";
import { ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export default function NotFound() {
  const { lang } = useLanguage();
  const isAR = lang === "ar";
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 text-center p-8" dir={isAR ? "rtl" : "ltr"}>
      <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
      <h1 className="text-4xl font-black text-gray-900 mb-2">404</h1>
      <p className="text-xl font-semibold text-gray-800 mb-2">{isAR ? "الصفحة غير موجودة" : "Page Not Found"}</p>
      <p className="text-gray-500 mb-8">{isAR ? "الصفحة التي تبحث عنها غير موجودة." : "The page you're looking for doesn't exist."}</p>
      <Link href="/">
        <button className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium shadow flex items-center gap-2">
          {isAR ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          {isAR ? "العودة للرئيسية" : "Back to Home"}
        </button>
      </Link>
    </div>
  );
}

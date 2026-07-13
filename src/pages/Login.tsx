import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, MessageSquare, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";

/** 登录页 — 居中卡片式布局，贴合 Trae 深色主题 */
export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAppStore((s) => s.login);

  const [email, setEmail] = useState("you@nimbus.chat");
  const [password, setPassword] = useState("demo1234");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.loginFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-text-secondary">
            {t("auth.email")}
          </label>
          <div className="flex items-center gap-2 h-11 px-3.5 rounded-[var(--radius-8)] bg-bg-tertiary border border-border-neutral focus-within:border-brand transition-colors duration-150">
            <Mail size={16} className="text-text-tertiary flex-shrink-0" />
            <input
              type="email"
              required
              autoComplete="email"
              className="flex-1 bg-transparent border-none outline-none text-text-default placeholder:text-text-tertiary text-[13px]"
              placeholder="you@nimbus.chat"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-text-secondary">
            {t("auth.password")}
          </label>
          <div className="flex items-center gap-2 h-11 px-3.5 rounded-[var(--radius-8)] bg-bg-tertiary border border-border-neutral focus-within:border-brand transition-colors duration-150">
            <Lock size={16} className="text-text-tertiary flex-shrink-0" />
            <input
              type={showPwd ? "text" : "password"}
              required
              autoComplete="current-password"
              className="flex-1 bg-transparent border-none outline-none text-text-default placeholder:text-text-tertiary text-[13px]"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="text-text-tertiary hover:text-text-default cursor-pointer transition-colors duration-150"
              aria-label={showPwd ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-[12px] text-status-error bg-[var(--border-error)] rounded-[var(--radius-6)] px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "h-11 rounded-[var(--radius-8)] bg-brand text-text-onbrand font-semibold text-[13px]",
            "hover:bg-brand-hover transition-colors duration-150 cursor-pointer",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "inline-flex items-center justify-center gap-2",
          )}
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {submitting ? t("auth.signingIn") : t("auth.signIn")}
        </button>

        <div className="text-center text-[12px] text-text-tertiary">
          {t("auth.newToNimbus")}{" "}
          <Link
            to="/register"
            className="text-brand hover:text-brand-hover font-medium"
          >
            {t("auth.createAnAccount")}
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}

/** 登录/注册共用的外壳 — 品牌 logo + 居中卡片 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-8 bg-bg-base-default">
      {/* 背景径向光晕 */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, rgba(50, 240, 140, 0.06) 0%, transparent 55%)",
        }}
      />
      <div className="relative w-full max-w-[400px] flex flex-col items-center">
        {/* 品牌 logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div
            className="w-10 h-10 rounded-[var(--radius-10)] flex items-center justify-center"
            style={{ background: "var(--bg-brand)" }}
          >
            <MessageSquare size={20} className="text-text-onbrand" />
          </div>
          <span className="font-heading text-[20px] font-semibold text-text-default-hover tracking-tight">
            {t("auth.brandName")}
          </span>
        </div>

        {/* 卡片 */}
        <div className="w-full bg-bg-menu border border-border-neutral rounded-[var(--radius-10)] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
          {children}
        </div>
      </div>
    </div>
  );
}

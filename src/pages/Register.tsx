import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, User, Eye, EyeOff, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { AuthShell } from "./Login";

/** 注册页 — 居中卡片式布局，复用登录外壳 */
export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const register = useAppStore((s) => s.register);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.registrationFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-text-secondary">
            {t("auth.displayName")}
          </label>
          <div className="flex items-center gap-2 h-11 px-3.5 rounded-[var(--radius-8)] bg-bg-tertiary border border-border-neutral focus-within:border-brand transition-colors duration-150">
            <User size={16} className="text-text-tertiary flex-shrink-0" />
            <input
              type="text"
              required
              autoComplete="name"
              className="flex-1 bg-transparent border-none outline-none text-text-default placeholder:text-text-tertiary text-[13px]"
              placeholder="Alex Chen"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
        </div>

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
              minLength={6}
              autoComplete="new-password"
              className="flex-1 bg-transparent border-none outline-none text-text-default placeholder:text-text-tertiary text-[13px]"
              placeholder={t("auth.newPasswordPlaceholder")}
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
          {submitting ? t("auth.creatingAccount") : t("auth.createAccount")}
        </button>

        <div className="text-center text-[12px] text-text-tertiary">
          {t("auth.alreadyHaveAccount")}{" "}
          <Link
            to="/login"
            className="text-brand hover:text-brand-hover font-medium"
          >
            {t("auth.signIn")}
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}

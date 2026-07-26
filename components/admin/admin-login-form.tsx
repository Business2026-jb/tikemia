"use client";

import {
  AlertCircle,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type LoginResponse = {
  success?: boolean;
  message?: string;
  redirectTo?: string;
};

export default function AdminLoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          rememberMe,
        }),
      });

      const result =
        (await response.json()) as LoginResponse;

      if (!response.ok || !result.success) {
        setErrorMessage(
          result.message ||
            "Impossible de vous connecter.",
        );

        return;
      }

      router.replace(
        result.redirectTo || "/admin/dashboard",
      );

      router.refresh();
    } catch (error) {
      console.error("ADMIN_LOGIN_FORM_ERROR", error);

      setErrorMessage(
        "Une erreur réseau est survenue. Vérifiez votre connexion.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 space-y-5"
      noValidate
    >
      {errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          />

          <p>{errorMessage}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <label
          htmlFor="admin-email"
          className="text-sm font-semibold text-slate-800"
        >
          Adresse email
        </label>

        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="admin@tikemia.com"
            required
            disabled={isSubmitting}
            className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-[15px] text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="admin-password"
          className="text-sm font-semibold text-slate-800"
        >
          Mot de passe
        </label>

        <div className="relative">
          <LockKeyhole
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            id="admin-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Votre mot de passe"
            required
            disabled={isSubmitting}
            className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-12 text-[15px] text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
          />

          <button
            type="button"
            onClick={() =>
              setShowPassword((current) => !current)
            }
            disabled={isSubmitting}
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed"
            aria-label={
              showPassword
                ? "Masquer le mot de passe"
                : "Afficher le mot de passe"
            }
          >
            {showPassword ? (
              <EyeOff
                className="h-5 w-5"
                aria-hidden="true"
              />
            ) : (
              <Eye
                className="h-5 w-5"
                aria-hidden="true"
              />
            )}
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-600">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(event) =>
            setRememberMe(event.target.checked)
          }
          disabled={isSubmitting}
          className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
        />

        Garder ma session ouverte
      </label>

      <button
        type="submit"
        disabled={isSubmitting || !email || !password}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 text-sm font-bold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <LoaderCircle
              className="h-5 w-5 animate-spin"
              aria-hidden="true"
            />
            Connexion en cours...
          </>
        ) : (
          <>
            <LockKeyhole
              className="h-5 w-5"
              aria-hidden="true"
            />
            Accéder à l’administration
          </>
        )}
      </button>
    </form>
  );
}
"use client";

import { useActionState } from "react";
import { login, register, type AuthFormState } from "@/app/actions/auth";

const initialState: AuthFormState = {};

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const action = mode === "login" ? login : register;
  const [state, formAction, pending] = useActionState(action, initialState);
  const registering = mode === "register";

  return (
    <form action={formAction} className="space-y-5">
      {registering && (
        <label className="block text-sm font-medium text-slate-200">
          Nombre y apellido
          <input
            className="auth-field mt-2"
            autoComplete="name"
            name="fullName"
            minLength={3}
            maxLength={100}
            placeholder="Nombre Apellido"
            required
          />
        </label>
      )}
      <label className="block text-sm font-medium text-slate-200">
        Cédula
        <input
          className="auth-field mt-2"
          autoComplete="username"
          name="cedula"
          minLength={5}
          maxLength={16}
          placeholder="V-12345678"
          required
        />
      </label>
      {registering && (
        <label className="block text-sm font-medium text-slate-200">
          Teléfono WhatsApp
          <input
            className="auth-field mt-2"
            autoComplete="tel"
            inputMode="tel"
            name="whatsappPhone"
            maxLength={24}
            placeholder="+58 412 123 4567"
            required
          />
        </label>
      )}
      <label className="block text-sm font-medium text-slate-200">
        Contraseña
        <input
          className="auth-field mt-2"
          autoComplete={registering ? "new-password" : "current-password"}
          type="password"
          name="password"
          minLength={registering ? 10 : 1}
          maxLength={72}
          required
        />
        {registering && (
          <span className="mt-1.5 block text-xs font-normal text-slate-400">
            Mínimo 10 caracteres.
          </span>
        )}
      </label>
      {state.error && (
        <p role="alert" className="rounded-lg border border-rose-900/60 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      )}
      <button className="auth-submit" type="submit" disabled={pending}>
        {pending && <span aria-hidden="true" className="spinner" />}
        {pending
          ? "Validando..."
          : registering
            ? "Crear cuenta de jugador"
            : "Iniciar sesión"}
      </button>
    </form>
  );
}

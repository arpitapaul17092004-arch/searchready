import { Suspense } from "react";
import LoginForm from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">Log in</h1>
      <Suspense fallback={<p className="mt-6 text-slate-500">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

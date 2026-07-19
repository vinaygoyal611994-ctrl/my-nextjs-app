import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle, Lock, ShieldCheck } from "lucide-react";

export default function ChangePasswordPage() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k: string) => setShow((s) => ({ ...s, [k]: !s[k as keyof typeof s] }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError("Please fill in all fields."); return;
    }
    if (form.newPassword.length < 6) {
      setError("New password must be at least 6 characters."); return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords do not match."); return;
    }
    if (form.currentPassword === form.newPassword) {
      setError("New password must be different from current password."); return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Failed to change password."); return; }
      setSuccess(true);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const strength = (() => {
    const p = form.newPassword;
    if (!p) return null;
    if (p.length < 6) return { label: "Too short", color: "bg-red-400", w: "w-1/4" };
    if (p.length < 8) return { label: "Weak", color: "bg-orange-400", w: "w-2/4" };
    if (!/[^a-zA-Z0-9]/.test(p)) return { label: "Medium", color: "bg-yellow-400", w: "w-3/4" };
    return { label: "Strong", color: "bg-green-500", w: "w-full" };
  })();

  return (
    <Layout title="Change Password">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <KeyRound size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Change Password</h1>
            <p className="text-sm text-gray-500">Update your login password</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {success ? (
            <div className="p-10 text-center">
              <div className="w-16 h-16 bg-green-50 border-2 border-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Password Changed!</h2>
              <p className="text-gray-500 text-sm mb-6">Your password has been updated successfully.</p>
              <button
                onClick={() => setSuccess(false)}
                className="text-sm text-amber-600 hover:text-amber-700 font-semibold"
              >
                Change again?
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Security note */}
              <div className="flex items-start gap-3 bg-blue-50 border-b border-blue-100 px-6 py-4">
                <ShieldCheck size={18} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Use a strong password with letters, numbers, and special characters. Never share your password.
                </p>
              </div>

              <div className="p-6 space-y-5">
                {/* Current password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Current Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={show.current ? "text" : "password"}
                      value={form.currentPassword}
                      onChange={(e) => set("currentPassword", e.target.value)}
                      placeholder="Enter your current password"
                      className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                    />
                    <button type="button" onClick={() => toggle("current")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                      {show.current ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-1" />

                {/* New password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    New Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={show.new ? "text" : "password"}
                      value={form.newPassword}
                      onChange={(e) => set("newPassword", e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                    />
                    <button type="button" onClick={() => toggle("new")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                      {show.new ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {strength && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">Password strength</span>
                        <span className={`text-xs font-semibold ${
                          strength.label === "Strong" ? "text-green-600"
                          : strength.label === "Medium" ? "text-yellow-600"
                          : "text-red-500"}`}>
                          {strength.label}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.w}`} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Confirm New Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={show.confirm ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(e) => set("confirmPassword", e.target.value)}
                      placeholder="Re-enter new password"
                      className={`w-full pl-10 pr-11 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all ${
                        form.confirmPassword && form.confirmPassword !== form.newPassword
                          ? "border-red-300 bg-red-50"
                          : "border-gray-200 bg-gray-50 focus:bg-white"
                      }`}
                    />
                    <button type="button" onClick={() => toggle("confirm")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                      {show.confirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {form.confirmPassword && form.confirmPassword !== form.newPassword && (
                    <p className="text-xs text-red-500 mt-1 ml-1">Passwords do not match</p>
                  )}
                  {form.confirmPassword && form.confirmPassword === form.newPassword && form.newPassword.length >= 6 && (
                    <p className="text-xs text-green-600 mt-1 ml-1 flex items-center gap-1">
                      <CheckCircle size={11} /> Passwords match
                    </p>
                  )}
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                    <span className="shrink-0">⚠️</span> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-300 text-gray-950 font-bold py-3.5 rounded-xl transition-all shadow-md shadow-amber-500/20 hover:-translate-y-0.5"
                >
                  {loading ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}

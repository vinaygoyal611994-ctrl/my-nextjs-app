import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import Decimal from "decimal.js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Indian number formatting: 2,75,000
export function formatINR(amount: number | Decimal | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : Number(amount);
  if (isNaN(num)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatWeight(kg: number | Decimal | string): string {
  const num = typeof kg === "string" ? parseFloat(kg) : Number(kg);
  if (isNaN(num)) return "0 kg";
  if (num >= 100) {
    return `${(num / 100).toFixed(2)} क्विंटल`;
  }
  return `${num.toFixed(2)} kg`;
}

export function kgToQtl(kg: number | Decimal): Decimal {
  return new Decimal(kg.toString()).div(100);
}

export function qtlToKg(qtl: number | Decimal): Decimal {
  return new Decimal(qtl.toString()).mul(100);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function todayISO(): string {
  return formatDateISO(new Date());
}

// Generate voucher number: PR-2024-0001
export function buildVoucherNo(
  prefix: string,
  year: number,
  seq: number
): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

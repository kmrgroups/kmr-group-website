"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ConfirmationContent() {
  const params = useSearchParams();
  const orderId = params.get("order_id");
  const failed = params.get("status") === "failed";

  return (
    <div className="mx-auto max-w-lg px-5 py-24 text-center">
      {failed ? (
        <>
          <p className="eyebrow text-red-600 mb-3">Payment Issue</p>
          <h1 className="font-display text-4xl mb-4">We couldn't confirm your payment</h1>
          <p className="text-slate mb-8">
            If money was deducted, it will be auto-refunded within a few business days. Contact us with your
            order reference below if you need help.
          </p>
        </>
      ) : (
        <>
          <p className="eyebrow text-signal mb-3">Order Placed</p>
          <h1 className="font-display text-4xl mb-4">Thank you for your order</h1>
          <p className="text-slate mb-8">
            We've received your payment and will contact you shortly to confirm shipping.
          </p>
        </>
      )}
      {orderId && (
        <p className="font-mono text-xs text-slate mb-8">Order reference: {orderId}</p>
      )}
      <Link href="/products" className="inline-block bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-6 py-3">
        Continue Shopping
      </Link>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmationContent />
    </Suspense>
  );
}

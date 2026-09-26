"use client";

export default function Communication({
  phone,
  orderNumber,
  customerName,
}: {
  phone: string;
  orderNumber: string;
  customerName: string;
}) {
  const msg = encodeURIComponent(
    `প্রিয় ${customerName}, আপনার অর্ডার ${orderNumber} সম্পর্কে জানাতে চাই।`
  );
  const wa = `https://wa.me/88${phone.replace(/^0/, "")}?text=${msg}`;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="text-slate-900 font-semibold mb-3">Contact Customer</h2>
      <div className="grid grid-cols-3 gap-2">
        <a
          href={`tel:${phone}`}
          className="flex flex-col items-center gap-1.5 py-3 rounded-lg border border-slate-200 hover:border-slate-400 transition"
        >
          <span className="text-lg">📞</span>
          <span className="text-xs text-slate-600">Call</span>
        </a>
        <a
          href={`sms:${phone}`}
          className="flex flex-col items-center gap-1.5 py-3 rounded-lg border border-slate-200 hover:border-slate-400 transition"
        >
          <span className="text-lg">💬</span>
          <span className="text-xs text-slate-600">SMS</span>
        </a>
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1.5 py-3 rounded-lg border border-slate-200 hover:border-emerald-400 transition"
        >
          <span className="text-lg">🟢</span>
          <span className="text-xs text-slate-600">WhatsApp</span>
        </a>
      </div>
    </div>
  );
}

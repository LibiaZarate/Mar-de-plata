import { useState } from "react";
import { store, type Channel } from "../data/store";

export default function RegisterOrderModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("CDMX");
  const [product, setProduct] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [channel, setChannel] = useState<Channel>("meta");
  const [advisor, setAdvisor] = useState<"eli" | "nat" | "jess">("eli");

  function submit() {
    if (!name || !product || !amount) return;
    store.registerOrder({
      name,
      city,
      amount: Number(amount),
      product,
      channel,
      advisor,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-cream-50 border border-ink/20 rounded-lg w-full max-w-[480px] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] tracking-[0.22em] uppercase text-ink-mute mb-2">
          Registrar pedido
        </div>
        <h2 className="font-serif-display text-3xl mb-5">Pedido cerrado</h2>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cliente">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Karina V."
              className="input"
            />
          </Field>
          <Field label="Ciudad">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Producto" wide>
            <input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="Charms Pandora · 2 piezas"
              className="input"
            />
          </Field>
          <Field label="Monto MXN">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="1840"
              className="input"
            />
          </Field>
          <Field label="Canal">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              className="input"
            >
              <option value="meta">Meta</option>
              <option value="tiktok">TikTok</option>
              <option value="grupo">Grupo abierto</option>
              <option value="recurrente">Recurrente</option>
              <option value="organico">Orgánico</option>
            </select>
          </Field>
          <Field label="Asesora" wide>
            <select
              value={advisor}
              onChange={(e) => setAdvisor(e.target.value as "eli" | "nat" | "jess")}
              className="input"
            >
              <option value="eli">Eli</option>
              <option value="nat">Nat</option>
              <option value="jess">Jess</option>
            </select>
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn">Cancelar</button>
          <button onClick={submit} className="btn-primary">
            Guardar pedido
          </button>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid rgba(43,38,32,0.25);
          border-radius: 6px;
          background: #FBF7F0;
          font-size: 14px;
          color: #2B2620;
          outline: none;
        }
        .input:focus { border-color: #C97A8B; }
      `}</style>
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={"flex flex-col gap-1 " + (wide ? "col-span-2" : "")}>
      <span className="label-xs">{label}</span>
      {children}
    </label>
  );
}

// Parse Loop OFICIAL — CLAUDE.md §14.
// Fragmenta la respuesta del Agente en mensajes ≤180 chars respetando
// saltos de párrafo, listas con guiones y URLs intactas. CRÍTICO para
// que se vea orgánico en WhatsApp.

export function parseLoop(agentResponse: string): string[] {
  const input = (agentResponse || "")
    .replace(/[¡¿]/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[()*]/g, "");

  const partes: string[] = [];
  const productosUnicos = new Set<string>();
  const urlRegex = /https?:\/\/[^\s]+/g;

  function dividirPorPuntosYSaltos(texto: string) {
    const parrafos = texto
      .split(/\n{2,}|\n(?=- )/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const parrafo of parrafos) {
      if (/^- /.test(parrafo)) {
        const lineas = parrafo.split(/\r?\n/).map((l) => l.trim());
        let grupo: string[] = [];
        for (const linea of lineas) {
          const candidato = grupo.concat(linea).join("\n");
          if (grupo.length && candidato.length > 180) {
            partes.push(grupo.join("\n"));
            grupo = [linea];
          } else {
            grupo.push(linea);
          }
        }
        if (grupo.length) partes.push(grupo.join("\n"));
        continue;
      }
      if (parrafo.length <= 180) {
        partes.push(parrafo);
      } else {
        const frases = parrafo.split(/(?<!Lic\.)(?<!Prof\.)(?<=[.!?])\s+/);
        let chunk = "";
        for (const frase of frases) {
          const cand = (chunk + " " + frase).trim();
          if (chunk && cand.length > 180) {
            partes.push(chunk);
            chunk = frase.trim();
          } else {
            chunk = cand;
          }
        }
        if (chunk) partes.push(chunk);
      }
    }
  }

  const bloques = input.split(/\n(?=\d+\.)/).map((b) => b.trim()).filter(Boolean);
  for (const bloqueRaw of bloques) {
    const bloque = bloqueRaw
      .replace(/:\s*-\s*/g, ":\n- ")
      .replace(/ - /g, "\n- ");
    const sinNombre = bloque.replace(/^\d+\.\s*/, "");
    const nombreMatch = sinNombre.match(/^(.+?):/);
    const nombre = nombreMatch ? nombreMatch[1].toLowerCase() : null;
    if (nombre && productosUnicos.has(nombre)) continue;
    if (nombre) productosUnicos.add(nombre);
    let cursor = 0;
    let m: RegExpExecArray | null;
    const re = new RegExp(urlRegex.source, "g");
    while ((m = re.exec(bloque)) !== null) {
      const before = bloque.slice(cursor, m.index).trim();
      if (before) dividirPorPuntosYSaltos(before);
      partes.push(m[0]);
      cursor = m.index + m[0].length;
    }
    const rest = bloque.slice(cursor).trim();
    if (rest) dividirPorPuntosYSaltos(rest);
  }

  if (!partes[0] && partes.length > 1) {
    partes[0] = partes[1];
    partes.splice(1, 1);
  }

  const textoCompleto = partes.join("\n\n");
  if (textoCompleto.length <= 500) {
    return [textoCompleto.trim()];
  }
  return partes.filter((p) => p && p.trim()).map((p) => p.trim());
}

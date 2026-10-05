import { sqlite } from "@workspace/db";

// Never rewrite item_code: it is the shared identity, not the display number.
export const legacyTemplateNumbers: Record<string, number> = {
  "101":101, "102":102, "103":103, "104":104, "105":105,
  "106":106, "107":107, "108":108, "109":109,
  "X-2f786b06-ca88-4261-b1a9-e4d4f2d423dd":110,
  "X-55226376-9f60-4ef6-adc0-038021fcc552":111,
  "X-777648f4-97fd-4269-b2c6-9e1e4cedef11":112,
};

export function ensureLocalTemplateNumbers() {
  if (!sqlite) return;
  const columns = sqlite.prepare("PRAGMA table_info(invoice_item_templates)").all() as Array<{name:string}>;
  if (!columns.some(column => column.name === "display_code")) {
    sqlite.exec("ALTER TABLE invoice_item_templates ADD COLUMN display_code INTEGER");
  }
  sqlite.transaction(() => {
    for (const [code,number] of Object.entries(legacyTemplateNumbers)) {
      const row = sqlite!.prepare("SELECT display_code FROM invoice_item_templates WHERE item_code=?").get(code) as {display_code:number|null}|undefined;
      if (row?.display_code != null && Number(row.display_code) !== number) throw new Error(`Legacy template number conflict: ${code}`);
      sqlite!.prepare("UPDATE invoice_item_templates SET display_code=? WHERE item_code=? AND display_code IS NULL").run(number,code);
    }
    sqlite!.exec("CREATE UNIQUE INDEX IF NOT EXISTS invoice_templates_display_code_unique ON invoice_item_templates(display_code)");
  })();
}

// Online alone allocates new numbers. Internal transfers carry them unchanged.
// The persistent registry prevents reuse after a template is deleted.
export async function ensurePgTemplateNumbers(client: any, allocate: boolean) {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock(68291302)");
    await client.query("ALTER TABLE public.invoice_item_templates ADD COLUMN IF NOT EXISTS display_code INTEGER");
    await client.query("LOCK TABLE public.invoice_item_templates IN SHARE ROW EXCLUSIVE MODE");
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS invoice_templates_shared_code_unique ON public.invoice_item_templates(item_code)");
    if (allocate) {
      await client.query("CREATE TABLE IF NOT EXISTS public.ledger_template_numbers (item_code TEXT PRIMARY KEY, display_code INTEGER NOT NULL UNIQUE)");
      for (const [code,number] of Object.entries(legacyTemplateNumbers)) {
        const conflict = await client.query("SELECT item_code,display_code FROM public.ledger_template_numbers WHERE item_code=$1 OR display_code=$2",[code,number]);
        if (conflict.rows.some((row:any) => row.item_code !== code || Number(row.display_code) !== number)) throw new Error(`Online template number conflict: ${code}`);
        await client.query("INSERT INTO public.ledger_template_numbers(item_code,display_code) VALUES($1,$2) ON CONFLICT(item_code) DO NOTHING",[code,number]);
      }
      const rows = await client.query("SELECT item_code,display_code FROM public.invoice_item_templates ORDER BY created_at ASC NULLS FIRST,item_code ASC");
      for (const row of rows.rows) {
        const code = String(row.item_code ?? "").trim();
        if (!code) throw new Error("Online template has no shared code");
        const registered = await client.query("SELECT display_code FROM public.ledger_template_numbers WHERE item_code=$1",[code]);
        let number = registered.rows[0]?.display_code;
        if (number == null) {
          if (row.display_code != null) {
            number = Number(row.display_code);
            if (!Number.isSafeInteger(number) || number < 101) throw new Error("Invalid template display number");
          } else {
            const next = await client.query("SELECT GREATEST(COALESCE(MAX(display_code),112),112)+1 AS number FROM public.ledger_template_numbers");
            number = Number(next.rows[0].number);
          }
          await client.query("INSERT INTO public.ledger_template_numbers(item_code,display_code) VALUES($1,$2)",[code,number]);
        }
        if (row.display_code != null && Number(row.display_code) !== Number(number)) throw new Error(`Immutable template number conflict: ${code}`);
        await client.query("UPDATE public.invoice_item_templates SET display_code=$1 WHERE item_code=$2 AND display_code IS NULL",[number,code]);
      }
    } else {
      for (const [code,number] of Object.entries(legacyTemplateNumbers)) {
        const rows = await client.query("SELECT display_code FROM public.invoice_item_templates WHERE item_code=$1",[code]);
        if (rows.rows.some((row:any) => row.display_code != null && Number(row.display_code) !== number)) throw new Error(`Internal legacy template number conflict: ${code}`);
        await client.query("UPDATE public.invoice_item_templates SET display_code=$1 WHERE item_code=$2 AND display_code IS NULL",[number,code]);
      }
    }
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS invoice_templates_display_code_unique ON public.invoice_item_templates(display_code)");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function pullAllocatedTemplateNumbers(client: any) {
  if (!sqlite) return;
  const result = await client.query("SELECT item_code,display_code FROM public.invoice_item_templates WHERE display_code IS NOT NULL");
  sqlite.transaction(() => {
    for (const row of result.rows) {
      const local = sqlite!.prepare("SELECT display_code FROM invoice_item_templates WHERE item_code=?").get(row.item_code) as {display_code:number|null}|undefined;
      if (!local) continue;
      if (local.display_code != null && Number(local.display_code) !== Number(row.display_code)) throw new Error(`Local template number conflict: ${row.item_code}`);
      sqlite!.prepare("UPDATE invoice_item_templates SET display_code=? WHERE item_code=? AND display_code IS NULL").run(Number(row.display_code),row.item_code);
    }
  })();
}

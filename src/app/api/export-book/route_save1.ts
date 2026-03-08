import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// Écrit du texte en gérant les retours à la ligne + wrap simple
function drawWrappedText(params: {
  page: any;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  lineHeight: number;
  font: any;
  fontSize: number;
}) {
  const { page, text, x, y, maxWidth, lineHeight, font, fontSize } = params;

  const paragraphs = String(text || "").split(/\n+/);
  let cursorY = y;

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";

    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      const width = font.widthOfTextAtSize(test, fontSize);

      if (width <= maxWidth) {
        line = test;
      } else {
        if (line) {
          page.drawText(line, { x, y: cursorY, size: fontSize, font });
          cursorY -= lineHeight;
        }
        line = w;
      }
    }

    if (line) {
      page.drawText(line, { x, y: cursorY, size: fontSize, font });
      cursorY -= lineHeight;
    }

    // espace entre paragraphes
    cursorY -= lineHeight * 0.5;
  }

  return cursorY;
}

export async function GET(req: Request) {
  try {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });
    }

    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Timeline (MVP: première)
    const { data: timelines, error: tErr } = await supabaseAuthed
      .from("timelines")
      .select("id,title")
      .limit(1);

    if (tErr || !timelines?.[0]) {
      return NextResponse.json({ error: tErr?.message || "Timeline not found" }, { status: 400 });
    }

    const timelineId = timelines[0].id as string;
    const timelineTitle = (timelines[0].title as string) || "Meemorize";

    // Chapitres validés
    const { data: chapters, error: cErr } = await supabaseAuthed
      .from("chapters")
      .select("id,chapter_title,chapter_text,created_at")
      .eq("timeline_id", timelineId)
      .eq("status", "validated")
      .order("created_at", { ascending: true });

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });

    const list = chapters ?? [];
    if (list.length === 0) {
      return NextResponse.json({ error: "Aucun chapitre validé à exporter." }, { status: 400 });
    }

    // --- PDF ---
    const pdfDoc = await PDFDocument.create();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // A4 en points
    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;

    const margin = 56;
    const maxWidth = A4_WIDTH - margin * 2;

    // Page de garde
    let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    page.drawText(timelineTitle, { x: margin, y: A4_HEIGHT - margin - 40, size: 24, font: fontBold });
    page.drawText("Export Meemorize App — chapitres validés", {
      x: margin,
      y: A4_HEIGHT - margin - 70,
      size: 12,
      font,
    });

    // Sommaire (simple)
    page.drawText("Sommaire", { x: margin, y: A4_HEIGHT - margin - 120, size: 16, font: fontBold });
    let y = A4_HEIGHT - margin - 150;
    for (let i = 0; i < list.length; i++) {
      const title = list[i].chapter_title || `Chapitre ${i + 1}`;
      page.drawText(`${i + 1}. ${title}`, { x: margin, y, size: 11, font });
      y -= 16;
      if (y < margin + 40) {
        page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        y = A4_HEIGHT - margin;
      }
    }

    // Pages chapitres
    for (let i = 0; i < list.length; i++) {
      const title = list[i].chapter_title || `Chapitre ${i + 1}`;
      const text = list[i].chapter_text || "";

      page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      let cursorY = A4_HEIGHT - margin;

      page.drawText(title, { x: margin, y: cursorY, size: 18, font: fontBold });
      cursorY -= 28;

      cursorY = drawWrappedText({
        page,
        text,
        x: margin,
        y: cursorY,
        maxWidth,
        lineHeight: 14,
        font,
        fontSize: 11,
      });

      // si ça déborde beaucoup, MVP: on ne pagine pas finement par overflow
      // (mais on peut l’améliorer ensuite si besoin)
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="meemorize-export.pdf"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

import { jsPDF } from "jspdf";
import type { DietPlanMeal, MealSlot } from "@/lib/api";

type RGB = [number, number, number];

const VIOLET: RGB = [124, 58, 237];
const TEAL: RGB = [13, 148, 136];
const INK: RGB = [23, 25, 34];
const MUTED: RGB = [110, 116, 128];
const LINE: RGB = [225, 227, 232];
const CARD_BG: RGB = [249, 249, 252];
const WHITE: RGB = [255, 255, 255];
const PROTEIN: RGB = [59, 130, 246];
const CARBS: RGB = [245, 158, 11];
const FAT: RGB = [244, 63, 94];
const DESTRUCTIVE: RGB = [220, 38, 38];
const DESTRUCTIVE_BG: RGB = [254, 242, 242];

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  mid_morning: "Mid-Morning Snack",
  lunch: "Lunch",
  evening_snack: "Evening Snack",
  dinner: "Dinner",
};

const SLOT_ORDER: MealSlot[] = ["breakfast", "mid_morning", "lunch", "evening_snack", "dinner"];

function lerpChannel(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function lerpColor(from: RGB, to: RGB, t: number): RGB {
  return [lerpChannel(from[0], to[0], t), lerpChannel(from[1], to[1], t), lerpChannel(from[2], to[2], t)];
}

/** Draws a smooth horizontal gradient by painting many thin vertical strips. */
function drawGradientRect(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  from: RGB,
  to: RGB,
  vertical = false
) {
  const steps = Math.max(24, Math.round((vertical ? height : width) * 2));
  const stepSize = (vertical ? height : width) / steps;
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const [r, g, b] = lerpColor(from, to, t);
    doc.setFillColor(r, g, b);
    if (vertical) {
      doc.rect(x, y + i * stepSize, width, stepSize + 0.6, "F");
    } else {
      doc.rect(x + i * stepSize, y, stepSize + 0.6, height, "F");
    }
  }
}

/** Wraps text once and reuses the same line array for both measuring and drawing, so what's measured is exactly what's drawn. */
function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  if (!text) return [];
  return doc.splitTextToSize(text, maxWidth) as string[];
}

interface Cursor {
  y: number;
}

const PAGE_MARGIN = 16;
const LINE_H = 4.2;

export interface DietPlanPdfInput {
  title: string;
  cuisine: string | null;
  targetCalories: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
  meals: (DietPlanMeal & { possible_conflicts?: string[] })[];
  personName?: string | null;
}

export function buildDietPlanPdf(input: DietPlanPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;

  function newPage() {
    doc.addPage();
    return { y: PAGE_MARGIN };
  }

  function ensureSpace(cursor: Cursor, needed: number): Cursor {
    if (cursor.y + needed > pageHeight - 22) {
      return newPage();
    }
    return cursor;
  }

  // --- Header banner ----------------------------------------------------
  const bannerHeight = 40;
  drawGradientRect(doc, 0, 0, pageWidth, bannerHeight, VIOLET, TEAL);

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("AURAFIT AI", PAGE_MARGIN, 13);
  doc.setFontSize(21);
  doc.text(input.title, PAGE_MARGIN, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const subtitle = [input.cuisine, input.personName ? `for ${input.personName}` : null]
    .filter(Boolean)
    .join(" · ");
  if (subtitle) doc.text(subtitle, PAGE_MARGIN, 33);

  const dateStr = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.setFontSize(9);
  doc.text(dateStr, pageWidth - PAGE_MARGIN, 13, { align: "right" });

  // Thin gradient accent line directly under the banner.
  drawGradientRect(doc, 0, bannerHeight, pageWidth, 1.6, TEAL, VIOLET);

  // --- Macro summary strip ------------------------------------------------
  let cursor: Cursor = { y: bannerHeight + 12 };
  const summaryHeight = 22;
  doc.setFillColor(...CARD_BG);
  doc.roundedRect(PAGE_MARGIN, cursor.y - 6, contentWidth, summaryHeight, 3, 3, "F");

  const summaryItems: { label: string; value: string; color: RGB }[] = [
    { label: "CALORIES", value: input.targetCalories ? `${Math.round(input.targetCalories)}` : "—", color: INK },
    { label: "PROTEIN", value: input.targetProteinG ? `${Math.round(input.targetProteinG)}g` : "—", color: PROTEIN },
    { label: "CARBS", value: input.targetCarbsG ? `${Math.round(input.targetCarbsG)}g` : "—", color: CARBS },
    { label: "FAT", value: input.targetFatG ? `${Math.round(input.targetFatG)}g` : "—", color: FAT },
  ];
  const boxWidth = contentWidth / 4;
  summaryItems.forEach((item, i) => {
    const bx = PAGE_MARGIN + i * boxWidth;
    if (i > 0) {
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.25);
      doc.line(bx, cursor.y - 4, bx, cursor.y + 12);
    }
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(item.label, bx + boxWidth / 2, cursor.y - 1, { align: "center" });
    doc.setTextColor(...item.color);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(item.value, bx + boxWidth / 2, cursor.y + 9, { align: "center" });
  });

  cursor.y += summaryHeight + 10;

  // --- Meal cards (each a full recipe) ------------------------------------
  type PdfMeal = DietPlanMeal & { possible_conflicts?: string[] };
  const orderedMeals = SLOT_ORDER.map((slot) => input.meals.find((m) => m.slot === slot)).filter(
    (m): m is PdfMeal => !!m
  );

  const accentWidth = 4;
  const padX = 6;
  const padY = 6;
  const innerX = PAGE_MARGIN + accentWidth + padX;
  const innerWidth = contentWidth - accentWidth - padX * 2 - 40; // reserve right column for macros
  const macroColX = PAGE_MARGIN + contentWidth - 34;

  orderedMeals.forEach((meal, index) => {
    const t = orderedMeals.length <= 1 ? 0 : index / (orderedMeals.length - 1);
    const accent = lerpColor(VIOLET, TEAL, t);

    // --- Measure content first, so the card background is drawn at the
    // right height and nothing downstream ever overlaps what came before.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    const nameLines = wrap(doc, meal.dish_name, innerWidth);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const descLines = wrap(doc, meal.description, innerWidth);

    const conflicts = meal.possible_conflicts ?? [];
    const conflictLines =
      conflicts.length > 0
        ? wrap(doc, `May contain: ${conflicts.join(", ")} — double-check before eating.`, innerWidth)
        : [];

    doc.setFontSize(8.5);
    const ingredientLineGroups = meal.ingredients.map((ing) =>
      wrap(doc, `•  ${ing.name} — ${ing.quantity}`, innerWidth)
    );
    const instructionLineGroups = meal.instructions.map((step, i) =>
      wrap(doc, `${i + 1}. ${step}`, innerWidth)
    );

    const headerRowH = 7; // slot badge + prep time row
    const nameH = nameLines.length * (LINE_H + 1.4);
    const descH = descLines.length * LINE_H;
    // Must match the conflict-box drawing block's actual y consumption below exactly:
    // 5mm gap + N lines * LINE_H + 2mm trailing gap.
    const conflictH = conflictLines.length > 0 ? 7 + conflictLines.length * LINE_H : 0;
    const ingredientsHeaderH = meal.ingredients.length > 0 ? 5 : 0;
    const ingredientsH = ingredientLineGroups.reduce((sum, lines) => sum + lines.length * LINE_H, 0);
    const instructionsHeaderH = meal.instructions.length > 0 ? 5 : 0;
    const instructionsH = instructionLineGroups.reduce((sum, lines) => sum + lines.length * LINE_H, 0);

    const contentH =
      headerRowH +
      nameH +
      2 +
      descH +
      conflictH +
      3 +
      ingredientsHeaderH +
      ingredientsH +
      4 +
      instructionsHeaderH +
      instructionsH;
    const cardHeight = contentH + padY * 2;

    cursor = ensureSpace(cursor, Math.min(cardHeight, pageHeight - PAGE_MARGIN * 2 - 22));

    const cardTop = cursor.y;

    // Card background + left gradient accent bar.
    doc.setFillColor(...CARD_BG);
    doc.roundedRect(PAGE_MARGIN, cardTop, contentWidth, cardHeight, 2.5, 2.5, "F");
    drawGradientRect(doc, PAGE_MARGIN, cardTop, accentWidth, cardHeight, VIOLET, TEAL, true);
    doc.setFillColor(...accent);
    doc.roundedRect(PAGE_MARGIN, cardTop, accentWidth, cardHeight, 1.2, 1.2, "F");

    let y = cardTop + padY;

    // Slot badge (gradient-tinted per meal position) + prep time.
    const slotText = SLOT_LABEL[meal.slot].toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const slotTextWidth = doc.getTextWidth(slotText) + 6;
    doc.setFillColor(...accent);
    doc.roundedRect(innerX, y - 4, slotTextWidth, 6, 1.5, 1.5, "F");
    doc.setTextColor(...WHITE);
    doc.text(slotText, innerX + 3, y);

    if (meal.prep_time_minutes > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`${meal.prep_time_minutes} min prep`, innerX + slotTextWidth + 4, y);
    }

    // Macro column, right-aligned, anchored to the same header row.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(`${Math.round(meal.calories)} kcal`, macroColX + 34, y - 1, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...PROTEIN);
    doc.text(`P ${Math.round(meal.protein_g)}g`, macroColX + 34, y + 4, { align: "right" });
    doc.setTextColor(...CARBS);
    doc.text(`C ${Math.round(meal.carbs_g)}g`, macroColX + 34, y + 8, { align: "right" });
    doc.setTextColor(...FAT);
    doc.text(`F ${Math.round(meal.fat_g)}g`, macroColX + 34, y + 12, { align: "right" });

    y += headerRowH;

    // Dish name.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    nameLines.forEach((line) => {
      y += LINE_H + 1.4;
      doc.text(line, innerX, y);
    });
    y += 2;

    // Description.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    descLines.forEach((line) => {
      y += LINE_H;
      doc.text(line, innerX, y);
    });

    // Allergen/avoid-list conflict notice. Gap is generous (5mm) because the
    // preceding description text's ascent extends upward from its own
    // baseline — too tight a gap here previously let this box's fill paint
    // over the last line of the description above it.
    if (conflictLines.length > 0) {
      y += 5;
      const boxH = conflictLines.length * LINE_H + 3;
      doc.setFillColor(...DESTRUCTIVE_BG);
      doc.roundedRect(innerX, y - 3, innerWidth, boxH, 1.5, 1.5, "F");
      doc.setTextColor(...DESTRUCTIVE);
      doc.setFontSize(7.5);
      conflictLines.forEach((line) => {
        doc.text(line, innerX + 2, y);
        y += LINE_H;
      });
      // y is now at the box's bottom edge (matches boxH above exactly).
      y += 2;
    }

    // Ingredients.
    if (meal.ingredients.length > 0) {
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...accent);
      doc.text("INGREDIENTS", innerX, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      ingredientLineGroups.forEach((lines) => {
        lines.forEach((line) => {
          y += LINE_H;
          doc.text(line, innerX, y);
        });
      });
    }

    // Instructions.
    if (meal.instructions.length > 0) {
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...accent);
      doc.text("INSTRUCTIONS", innerX, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      instructionLineGroups.forEach((lines) => {
        lines.forEach((line) => {
          y += LINE_H;
          doc.text(line, innerX, y);
        });
      });
    }

    cursor = { y: cardTop + cardHeight + 6 };
  });

  // --- Footer -------------------------------------------------------------
  const pageCount = doc.internal.pages.length - 1;
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    drawGradientRect(doc, 0, pageHeight - 14, pageWidth, 0.8, VIOLET, TEAL);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      "Generated by AuraFit AI, entirely on-device. Not a medical or nutritional prescription.",
      PAGE_MARGIN,
      pageHeight - 8
    );
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - PAGE_MARGIN, pageHeight - 8, { align: "right" });
  }

  return doc;
}

/** Returns the raw base64 body (no data: prefix) for handing to the Rust write command. */
export function dietPlanPdfBase64(input: DietPlanPdfInput): string {
  const doc = buildDietPlanPdf(input);
  const dataUri = doc.output("datauristring");
  return dataUri.split(",")[1] ?? "";
}

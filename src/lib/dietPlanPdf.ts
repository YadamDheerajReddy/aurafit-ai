import { jsPDF } from "jspdf";
import type { DietPlanMeal, MealSlot } from "@/lib/api";

const VIOLET: [number, number, number] = [124, 58, 237];
const TEAL: [number, number, number] = [13, 148, 136];
const INK: [number, number, number] = [23, 25, 34];
const MUTED: [number, number, number] = [110, 116, 128];
const LINE: [number, number, number] = [225, 227, 232];
const PROTEIN: [number, number, number] = [59, 130, 246];
const CARBS: [number, number, number] = [245, 158, 11];
const FAT: [number, number, number] = [244, 63, 94];

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  mid_morning: "Mid-Morning Snack",
  lunch: "Lunch",
  evening_snack: "Evening Snack",
  dinner: "Dinner",
};

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function drawGradientBanner(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  from: [number, number, number],
  to: [number, number, number]
) {
  const steps = 120;
  const stepWidth = width / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = lerp(from[0], to[0], t);
    const g = lerp(from[1], to[1], t);
    const b = lerp(from[2], to[2], t);
    doc.setFillColor(r, g, b);
    doc.rect(x + i * stepWidth, y, stepWidth + 0.5, height, "F");
  }
}

export interface DietPlanPdfInput {
  title: string;
  cuisine: string | null;
  targetCalories: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
  meals: DietPlanMeal[];
  personName?: string | null;
}

export function buildDietPlanPdf(input: DietPlanPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // --- Header banner -------------------------------------------------
  drawGradientBanner(doc, 0, 0, pageWidth, 38, VIOLET, TEAL);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("AURAFIT AI", margin, 12);
  doc.setFontSize(20);
  doc.text(input.title, margin, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const subtitle = [input.cuisine, input.personName ? `for ${input.personName}` : null]
    .filter(Boolean)
    .join(" · ");
  if (subtitle) doc.text(subtitle, margin, 32);

  const dateStr = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.setFontSize(9);
  doc.text(dateStr, pageWidth - margin, 12, { align: "right" });

  // --- Macro summary strip --------------------------------------------
  let y = 48;
  const summaryItems: { label: string; value: string; color: [number, number, number] }[] = [
    { label: "CALORIES", value: input.targetCalories ? `${Math.round(input.targetCalories)}` : "—", color: INK },
    { label: "PROTEIN", value: input.targetProteinG ? `${Math.round(input.targetProteinG)}g` : "—", color: PROTEIN },
    { label: "CARBS", value: input.targetCarbsG ? `${Math.round(input.targetCarbsG)}g` : "—", color: CARBS },
    { label: "FAT", value: input.targetFatG ? `${Math.round(input.targetFatG)}g` : "—", color: FAT },
  ];
  const boxWidth = contentWidth / 4;
  summaryItems.forEach((item, i) => {
    const bx = margin + i * boxWidth;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    if (i > 0) doc.line(bx, y - 4, bx, y + 10);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(item.label, bx + boxWidth / 2, y - 1, { align: "center" });
    doc.setTextColor(...item.color);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(item.value, bx + boxWidth / 2, y + 8, { align: "center" });
  });

  y += 18;
  doc.setDrawColor(...LINE);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // --- Meal timetable ---------------------------------------------------
  const slotOrder: MealSlot[] = ["breakfast", "mid_morning", "lunch", "evening_snack", "dinner"];
  const orderedMeals = slotOrder
    .map((slot) => input.meals.find((m) => m.slot === slot))
    .filter((m): m is DietPlanMeal => !!m);

  const rowHeight = 30;
  const timeColWidth = 38;

  for (const meal of orderedMeals) {
    if (y + rowHeight > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }

    // Row background (alternating)
    doc.setFillColor(248, 248, 251);
    doc.roundedRect(margin, y, contentWidth, rowHeight, 2, 2, "F");

    // Time-slot badge
    doc.setFillColor(...VIOLET);
    doc.roundedRect(margin + 4, y + 5, timeColWidth - 8, 20, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const label = SLOT_LABEL[meal.slot];
    const labelLines = doc.splitTextToSize(label.toUpperCase(), timeColWidth - 12);
    doc.text(labelLines, margin + timeColWidth / 2, y + 15 - (labelLines.length - 1) * 2, {
      align: "center",
    });

    // Dish name + description
    const textX = margin + timeColWidth + 4;
    const textWidth = contentWidth - timeColWidth - 4 - 46;
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(meal.dish_name, textX, y + 10);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const descLines = doc.splitTextToSize(meal.description, textWidth);
    doc.text(descLines.slice(0, 2), textX, y + 16);

    // Macro badges
    const macroX = margin + contentWidth - 44;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(`${Math.round(meal.calories)} kcal`, macroX, y + 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PROTEIN);
    doc.text(`P ${Math.round(meal.protein_g)}g`, macroX, y + 15);
    doc.setTextColor(...CARBS);
    doc.text(`C ${Math.round(meal.carbs_g)}g`, macroX, y + 20);
    doc.setTextColor(...FAT);
    doc.text(`F ${Math.round(meal.fat_g)}g`, macroX, y + 25);

    y += rowHeight + 6;
  }

  // --- Footer -----------------------------------------------------------
  const pageCount = doc.internal.pages.length - 1;
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...LINE);
    doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      "Generated by AuraFit AI, entirely on-device. Not a medical or nutritional prescription.",
      margin,
      pageHeight - 10
    );
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }

  return doc;
}

/** Returns the raw base64 body (no data: prefix) for handing to the Rust write command. */
export function dietPlanPdfBase64(input: DietPlanPdfInput): string {
  const doc = buildDietPlanPdf(input);
  const dataUri = doc.output("datauristring");
  return dataUri.split(",")[1] ?? "";
}

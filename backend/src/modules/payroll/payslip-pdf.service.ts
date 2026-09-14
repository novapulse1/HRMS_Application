import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface PayslipPdfData {
  companyName: string;
  companyAddress?: string | null;
  companyContactEmail?: string | null;
  employeeName: string;
  employeeCode: string;
  departmentName?: string | null;
  designationName?: string | null;
  payType: string;
  month: number;
  year: number;
  workingDays: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  overtimeHours: number;
  overtimeAmount: number;
  grossAmount: number;
  deductions: Record<string, number>;
  totalDeductions: number;
  netAmount: number;
  status: string;
  generatedAt: Date;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export async function generatePayslipPdfBuffer(data: PayslipPdfData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  // Standard A4: 595.28 x 841.89 points
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Palette
  const primaryColor = rgb(0.08, 0.2, 0.45); // Deep navy #143373
  const darkText = rgb(0.12, 0.15, 0.2);
  const grayText = rgb(0.4, 0.45, 0.52);
  const tableHeaderBg = rgb(0.93, 0.95, 0.98);
  const borderColor = rgb(0.85, 0.88, 0.92);
  const greenHighlight = rgb(0.05, 0.55, 0.35);

  let cursorY = height - 50;

  // 1. Top Header Banner
  page.drawRectangle({
    x: 40,
    y: cursorY - 60,
    width: width - 80,
    height: 70,
    color: rgb(0.97, 0.98, 1.0),
    borderColor: borderColor,
    borderWidth: 1,
  });

  page.drawText(data.companyName.toUpperCase(), {
    x: 55,
    y: cursorY - 15,
    size: 16,
    font: fontBold,
    color: primaryColor,
  });

  const monthName = MONTH_NAMES[data.month - 1] || `Month ${data.month}`;
  page.drawText(`PAYSLIP — ${monthName.toUpperCase()} ${data.year}`, {
    x: 55,
    y: cursorY - 35,
    size: 11,
    font: fontBold,
    color: darkText,
  });

  if (data.companyContactEmail) {
    page.drawText(`Email: ${data.companyContactEmail}`, {
      x: 55,
      y: cursorY - 50,
      size: 9,
      font: fontRegular,
      color: grayText,
    });
  }

  // Right Badge for Status
  const statusLabel = data.status.toUpperCase();
  page.drawRectangle({
    x: width - 150,
    y: cursorY - 35,
    width: 90,
    height: 22,
    color: data.status === 'paid' ? rgb(0.88, 0.97, 0.92) : rgb(0.92, 0.95, 1.0),
    borderColor: data.status === 'paid' ? greenHighlight : primaryColor,
    borderWidth: 1,
  });
  page.drawText(statusLabel, {
    x: width - 135,
    y: cursorY - 26,
    size: 9,
    font: fontBold,
    color: data.status === 'paid' ? greenHighlight : primaryColor,
  });

  cursorY -= 85;

  // 2. Employee Details Grid
  page.drawRectangle({
    x: 40,
    y: cursorY - 95,
    width: width - 80,
    height: 95,
    color: rgb(1, 1, 1),
    borderColor: borderColor,
    borderWidth: 1,
  });

  const leftColX = 55;
  const midColX = 310;
  let empRowY = cursorY - 20;

  // Row 1
  page.drawText('Employee Name:', { x: leftColX, y: empRowY, size: 9, font: fontRegular, color: grayText });
  page.drawText(data.employeeName, { x: leftColX + 90, y: empRowY, size: 9, font: fontBold, color: darkText });

  page.drawText('Employee Code:', { x: midColX, y: empRowY, size: 9, font: fontRegular, color: grayText });
  page.drawText(data.employeeCode, { x: midColX + 90, y: empRowY, size: 9, font: fontBold, color: darkText });

  // Row 2
  empRowY -= 22;
  page.drawText('Department:', { x: leftColX, y: empRowY, size: 9, font: fontRegular, color: grayText });
  page.drawText(data.departmentName || 'General', { x: leftColX + 90, y: empRowY, size: 9, font: fontBold, color: darkText });

  page.drawText('Designation:', { x: midColX, y: empRowY, size: 9, font: fontRegular, color: grayText });
  page.drawText(data.designationName || 'Team Member', { x: midColX + 90, y: empRowY, size: 9, font: fontBold, color: darkText });

  // Row 3
  empRowY -= 22;
  page.drawText('Pay Structure:', { x: leftColX, y: empRowY, size: 9, font: fontRegular, color: grayText });
  page.drawText(data.payType.toUpperCase(), { x: leftColX + 90, y: empRowY, size: 9, font: fontBold, color: darkText });

  page.drawText('Working / Present:', { x: midColX, y: empRowY, size: 9, font: fontRegular, color: grayText });
  page.drawText(`${data.workingDays} Days / ${data.presentDays} Days`, { x: midColX + 90, y: empRowY, size: 9, font: fontBold, color: darkText });

  // Row 4
  empRowY -= 22;
  page.drawText('Leave (Paid/Unpaid):', { x: leftColX, y: empRowY, size: 9, font: fontRegular, color: grayText });
  page.drawText(`${data.paidLeaveDays} Paid / ${data.unpaidLeaveDays} Unpaid`, { x: leftColX + 90, y: empRowY, size: 9, font: fontBold, color: darkText });

  if (data.overtimeHours > 0) {
    page.drawText('Overtime Hours:', { x: midColX, y: empRowY, size: 9, font: fontRegular, color: grayText });
    page.drawText(`${data.overtimeHours.toFixed(1)} hrs`, { x: midColX + 90, y: empRowY, size: 9, font: fontBold, color: darkText });
  }

  cursorY -= 120;

  // 3. Earnings & Deductions Tables
  const colWidth = (width - 80) / 2;

  // Table Headers
  page.drawRectangle({
    x: 40,
    y: cursorY - 24,
    width: colWidth,
    height: 24,
    color: tableHeaderBg,
    borderColor: borderColor,
    borderWidth: 1,
  });
  page.drawText('EARNINGS', { x: 55, y: cursorY - 16, size: 9, font: fontBold, color: primaryColor });
  page.drawText('AMOUNT ($)', { x: 40 + colWidth - 75, y: cursorY - 16, size: 9, font: fontBold, color: primaryColor });

  page.drawRectangle({
    x: 40 + colWidth,
    y: cursorY - 24,
    width: colWidth,
    height: 24,
    color: tableHeaderBg,
    borderColor: borderColor,
    borderWidth: 1,
  });
  page.drawText('DEDUCTIONS', { x: 40 + colWidth + 15, y: cursorY - 16, size: 9, font: fontBold, color: primaryColor });
  page.drawText('AMOUNT ($)', { x: width - 95, y: cursorY - 16, size: 9, font: fontBold, color: primaryColor });

  cursorY -= 24;

  // Content Rows
  const earningsItems: Array<{ label: string; amount: number }> = [
    { label: 'Basic / Standard Pay', amount: Math.max(0, data.grossAmount - data.overtimeAmount) },
  ];
  if (data.overtimeAmount > 0) {
    earningsItems.push({ label: `Overtime (${data.overtimeHours} hrs)`, amount: data.overtimeAmount });
  }

  const deductionItems: Array<{ label: string; amount: number }> = [];
  for (const [key, val] of Object.entries(data.deductions)) {
    deductionItems.push({ label: key, amount: val });
  }
  if (deductionItems.length === 0) {
    deductionItems.push({ label: 'No Deductions', amount: 0 });
  }

  const maxRows = Math.max(earningsItems.length, deductionItems.length, 3);
  const rowHeight = 26;

  for (let i = 0; i < maxRows; i++) {
    const rowY = cursorY - (i + 1) * rowHeight;
    const isEven = i % 2 === 0;
    const rowBg = isEven ? rgb(1, 1, 1) : rgb(0.98, 0.99, 1);

    // Left Cell
    page.drawRectangle({
      x: 40,
      y: rowY,
      width: colWidth,
      height: rowHeight,
      color: rowBg,
      borderColor: borderColor,
      borderWidth: 0.5,
    });
    if (i < earningsItems.length) {
      page.drawText(earningsItems[i].label, { x: 55, y: rowY + 9, size: 9, font: fontRegular, color: darkText });
      const amtStr = `$ ${earningsItems[i].amount.toFixed(2)}`;
      const amtWidth = fontRegular.widthOfTextAtSize(amtStr, 9);
      page.drawText(amtStr, { x: 40 + colWidth - 15 - amtWidth, y: rowY + 9, size: 9, font: fontRegular, color: darkText });
    }

    // Right Cell
    page.drawRectangle({
      x: 40 + colWidth,
      y: rowY,
      width: colWidth,
      height: rowHeight,
      color: rowBg,
      borderColor: borderColor,
      borderWidth: 0.5,
    });
    if (i < deductionItems.length) {
      page.drawText(deductionItems[i].label, { x: 40 + colWidth + 15, y: rowY + 9, size: 9, font: fontRegular, color: darkText });
      const amtStr = `$ ${deductionItems[i].amount.toFixed(2)}`;
      const amtWidth = fontRegular.widthOfTextAtSize(amtStr, 9);
      page.drawText(amtStr, { x: width - 55 - amtWidth, y: rowY + 9, size: 9, font: fontRegular, color: darkText });
    }
  }

  cursorY -= maxRows * rowHeight;

  // Subtotals Row
  const totalRowY = cursorY - 26;
  page.drawRectangle({
    x: 40,
    y: totalRowY,
    width: colWidth,
    height: 26,
    color: rgb(0.95, 0.96, 0.98),
    borderColor: borderColor,
    borderWidth: 1,
  });
  page.drawText('Gross Earnings', { x: 55, y: totalRowY + 8, size: 9, font: fontBold, color: darkText });
  const grossStr = `$ ${data.grossAmount.toFixed(2)}`;
  const grossWidth = fontBold.widthOfTextAtSize(grossStr, 9);
  page.drawText(grossStr, { x: 40 + colWidth - 15 - grossWidth, y: totalRowY + 8, size: 9, font: fontBold, color: darkText });

  page.drawRectangle({
    x: 40 + colWidth,
    y: totalRowY,
    width: colWidth,
    height: 26,
    color: rgb(0.95, 0.96, 0.98),
    borderColor: borderColor,
    borderWidth: 1,
  });
  page.drawText('Total Deductions', { x: 40 + colWidth + 15, y: totalRowY + 8, size: 9, font: fontBold, color: darkText });
  const dedStr = `$ ${data.totalDeductions.toFixed(2)}`;
  const dedWidth = fontBold.widthOfTextAtSize(dedStr, 9);
  page.drawText(dedStr, { x: width - 55 - dedWidth, y: totalRowY + 8, size: 9, font: fontBold, color: darkText });

  cursorY -= 60;

  // 4. Net Pay Callout Box
  page.drawRectangle({
    x: 40,
    y: cursorY - 55,
    width: width - 80,
    height: 55,
    color: rgb(0.95, 0.98, 0.95),
    borderColor: greenHighlight,
    borderWidth: 1.5,
  });

  page.drawText('NET SALARY PAYABLE', {
    x: 55,
    y: cursorY - 24,
    size: 11,
    font: fontBold,
    color: greenHighlight,
  });

  const netPayStr = `$ ${data.netAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const netPayWidth = fontBold.widthOfTextAtSize(netPayStr, 16);
  page.drawText(netPayStr, {
    x: width - 55 - netPayWidth,
    y: cursorY - 24,
    size: 16,
    font: fontBold,
    color: greenHighlight,
  });

  page.drawText('Payment is subject to company payroll processing schedule and verified timesheets.', {
    x: 55,
    y: cursorY - 44,
    size: 8,
    font: fontRegular,
    color: grayText,
  });

  // 5. Document Footer
  const footerY = 40;
  page.drawLine({
    start: { x: 40, y: footerY + 15 },
    end: { x: width - 40, y: footerY + 15 },
    thickness: 0.5,
    color: borderColor,
  });

  page.drawText(
    `Nova Pulse HRMS • Generated on ${new Date(data.generatedAt).toUTCString()} • Strictly Confidential`,
    {
      x: 40,
      y: footerY,
      size: 8,
      font: fontRegular,
      color: grayText,
    }
  );

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface Form16PdfData {
  companyName: string;
  companyAddress?: string | null;
  companyContactEmail?: string | null;
  employeeName: string;
  employeeCode: string;
  departmentName?: string | null;
  designationName?: string | null;
  financialYear: string;
  assessmentYear: string;
  taxRegime: string;
  grossSalary: number;
  standardDeduction: number;
  providentFundDeduction: number;
  totalExemptions: number;
  taxableIncome: number;
  calculatedTax: number;
  healthAndEduCess: number;
  totalTaxLiability: number;
  tdsDeducted: number;
  balancePayable: number;
  generatedAt: Date;
}

export async function generateForm16PdfBuffer(data: Form16PdfData): Promise<Buffer> {
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

  let cursorY = height - 40;

  // 1. Header Banner
  page.drawRectangle({
    x: 40,
    y: cursorY - 65,
    width: width - 80,
    height: 75,
    color: rgb(0.97, 0.98, 1.0),
    borderColor: borderColor,
    borderWidth: 1,
  });

  page.drawText(data.companyName.toUpperCase(), {
    x: 55,
    y: cursorY - 15,
    size: 15,
    font: fontBold,
    color: primaryColor,
  });

  page.drawText('FORM NO. 16 — PART B (CERTIFICATE OF TAX DEDUCTED AT SOURCE)', {
    x: 55,
    y: cursorY - 35,
    size: 10,
    font: fontBold,
    color: darkText,
  });

  page.drawText(`Under Section 203 of the Income-tax Act, 1961 | FY: ${data.financialYear} | AY: ${data.assessmentYear}`, {
    x: 55,
    y: cursorY - 50,
    size: 8.5,
    font: fontRegular,
    color: grayText,
  });

  // Badge for Regime
  page.drawRectangle({
    x: width - 165,
    y: cursorY - 35,
    width: 110,
    height: 22,
    color: rgb(0.88, 0.97, 0.92),
    borderColor: greenHighlight,
    borderWidth: 1,
  });
  page.drawText(data.taxRegime.replace('_', ' ').toUpperCase(), {
    x: width - 155,
    y: cursorY - 26,
    size: 8.5,
    font: fontBold,
    color: greenHighlight,
  });

  cursorY -= 85;

  // 2. Employee and Employer Summary
  page.drawRectangle({
    x: 40,
    y: cursorY - 75,
    width: width - 80,
    height: 75,
    color: rgb(1, 1, 1),
    borderColor: borderColor,
    borderWidth: 1,
  });

  const leftColX = 55;
  const midColX = 310;
  let empRowY = cursorY - 18;

  page.drawText('Employee Name:', { x: leftColX, y: empRowY, size: 9, font: fontRegular, color: grayText });
  page.drawText(data.employeeName, { x: leftColX + 90, y: empRowY, size: 9, font: fontBold, color: darkText });

  page.drawText('Employee Code:', { x: midColX, y: empRowY, size: 9, font: fontRegular, color: grayText });
  page.drawText(data.employeeCode, { x: midColX + 90, y: empRowY, size: 9, font: fontBold, color: darkText });

  empRowY -= 20;
  page.drawText('Department:', { x: leftColX, y: empRowY, size: 9, font: fontRegular, color: grayText });
  page.drawText(data.departmentName || 'General', { x: leftColX + 90, y: empRowY, size: 9, font: fontBold, color: darkText });

  page.drawText('Designation:', { x: midColX, y: empRowY, size: 9, font: fontRegular, color: grayText });
  page.drawText(data.designationName || 'Team Member', { x: midColX + 90, y: empRowY, size: 9, font: fontBold, color: darkText });

  empRowY -= 20;
  page.drawText('Financial Year:', { x: leftColX, y: empRowY, size: 9, font: fontRegular, color: grayText });
  page.drawText(data.financialYear, { x: leftColX + 90, y: empRowY, size: 9, font: fontBold, color: darkText });

  page.drawText('Assessment Year:', { x: midColX, y: empRowY, size: 9, font: fontRegular, color: grayText });
  page.drawText(data.assessmentYear, { x: midColX + 90, y: empRowY, size: 9, font: fontBold, color: darkText });

  cursorY -= 95;

  // 3. Tax Computation Table Header
  const tableX = 40;
  const tableWidth = width - 80;
  const rowHeight = 24;

  page.drawRectangle({
    x: tableX,
    y: cursorY - rowHeight,
    width: tableWidth,
    height: rowHeight,
    color: tableHeaderBg,
    borderColor: borderColor,
    borderWidth: 1,
  });

  page.drawText('PARTICULARS / COMPUTATION OF TOTAL INCOME', {
    x: tableX + 15,
    y: cursorY - 16,
    size: 9,
    font: fontBold,
    color: primaryColor,
  });

  page.drawText('AMOUNT (INR)', {
    x: tableX + tableWidth - 100,
    y: cursorY - 16,
    size: 9,
    font: fontBold,
    color: primaryColor,
  });

  cursorY -= rowHeight;

  // Rows of Tax Computation
  const items: Array<{ label: string; amount: number; isBold?: boolean; isHighlight?: boolean }> = [
    { label: '1. Gross Salary as per provisions contained in section 17(1)', amount: data.grossSalary },
    { label: '2. Less: Deductions under Section 16 (Standard Deduction)', amount: data.standardDeduction },
    { label: '3. Less: Employee Provident Fund (Section 80C)', amount: data.providentFundDeduction },
    { label: '4. Total Deductions / Exemptions', amount: data.totalExemptions, isBold: true },
    { label: '5. Total Taxable Income (1 - 4)', amount: data.taxableIncome, isBold: true, isHighlight: true },
    { label: '6. Tax Computed on Total Income (Section 115BAC / Slab)', amount: data.calculatedTax },
    { label: '7. Health & Education Cess @ 4%', amount: data.healthAndEduCess },
    { label: '8. Total Tax Liability (6 + 7)', amount: data.totalTaxLiability, isBold: true },
    { label: '9. Less: Tax Deducted at Source (TDS)', amount: data.tdsDeducted },
    { label: '10. Net Tax Payable / (Refundable)', amount: data.balancePayable, isBold: true, isHighlight: true },
  ];

  for (const item of items) {
    page.drawRectangle({
      x: tableX,
      y: cursorY - rowHeight,
      width: tableWidth,
      height: rowHeight,
      color: item.isHighlight ? rgb(0.95, 0.98, 1.0) : rgb(1, 1, 1),
      borderColor: borderColor,
      borderWidth: 1,
    });

    page.drawText(item.label, {
      x: tableX + 15,
      y: cursorY - 16,
      size: 8.5,
      font: item.isBold ? fontBold : fontRegular,
      color: item.isBold ? darkText : rgb(0.2, 0.25, 0.3),
    });

    const formattedAmount = `₹ ${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    page.drawText(formattedAmount, {
      x: tableX + tableWidth - 110,
      y: cursorY - 16,
      size: 8.5,
      font: item.isBold ? fontBold : fontRegular,
      color: item.isHighlight ? primaryColor : darkText,
    });

    cursorY -= rowHeight;
  }

  cursorY -= 25;

  // 4. Verification Statement
  page.drawRectangle({
    x: 40,
    y: cursorY - 70,
    width: width - 80,
    height: 70,
    color: rgb(0.98, 0.99, 1.0),
    borderColor: borderColor,
    borderWidth: 1,
  });

  page.drawText('VERIFICATION', {
    x: 55,
    y: cursorY - 15,
    size: 9,
    font: fontBold,
    color: primaryColor,
  });

  const verificationText =
    `I certify that a sum of INR ${data.tdsDeducted.toLocaleString('en-IN', { minimumFractionDigits: 2 })} has been deducted at source and paid to the credit of the Central Government. Further, the information given above is true, complete and correct.`;

  page.drawText(verificationText.substring(0, 100), {
    x: 55,
    y: cursorY - 32,
    size: 8,
    font: fontRegular,
    color: grayText,
  });
  page.drawText(verificationText.substring(100), {
    x: 55,
    y: cursorY - 44,
    size: 8,
    font: fontRegular,
    color: grayText,
  });

  page.drawText(`Generated on: ${data.generatedAt.toLocaleDateString('en-GB')}`, {
    x: 55,
    y: cursorY - 58,
    size: 8,
    font: fontRegular,
    color: grayText,
  });

  page.drawText('Authorized Signatory', {
    x: width - 180,
    y: cursorY - 58,
    size: 8.5,
    font: fontBold,
    color: darkText,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

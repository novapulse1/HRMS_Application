import { reportsService } from '../src/modules/reports/reports.service';

describe('CSV RFC-4180 Escaping Specification Compliance', () => {
  // Access private formatCsvRow via instance reflection
  const formatCsvRow = (reportsService as any).formatCsvRow.bind(reportsService);

  it('escapes fields containing commas without shifting column boundaries', () => {
    const row = formatCsvRow(['EMP-001', 'John Doe', 'Family emergency, doctor visit']);
    expect(row).toBe('"EMP-001","John Doe","Family emergency, doctor visit"');

    // Split using RFC-4180 parser rules (ignoring commas inside quotes)
    const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(row)) !== null) {
      matches.push(match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2]);
    }
    // Remove the extra empty match that trailing regex may produce
    if (matches.length > 3) matches.pop();

    expect(matches.length).toBe(3);
    expect(matches[0]).toBe('EMP-001');
    expect(matches[1]).toBe('John Doe');
    expect(matches[2]).toBe('Family emergency, doctor visit');
  });

  it('escapes double quotes by doubling them ("")', () => {
    const row = formatCsvRow(['EMP-002', 'Alice "Architect" Walker', 'Normal reason']);
    expect(row).toBe('"EMP-002","Alice ""Architect"" Walker","Normal reason"');
  });

  it('handles null and undefined values safely as empty quoted strings', () => {
    const row = formatCsvRow(['EMP-003', null, undefined]);
    expect(row).toBe('"EMP-003","",""');
  });
});

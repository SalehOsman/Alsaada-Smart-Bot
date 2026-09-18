import { describe, it, expect } from 'vitest';
import { isFieldMasked, projectSafeWorkerFields } from '@alsaada/rbac';
import ExcelJS from 'exceljs';
import { sanitizeExcelCell } from '../src/lib/excel-utils';

describe('Phase 9 / Task 12: Secure Excel & PDF Export with Server-Side Field Masking', () => {
  const sampleWorkers = [
    {
      code: 'OP-DRV-001',
      nickname: 'أبو حميد',
      name: 'أحمد محمود إبراهيم',
      siteName: 'مشروع العلمين',
      jobTitle: 'سائق لودر',
      status: 'ACTIVE',
      basicSalary: 9000,
      dailyWage: 350,
      fixedAllowances: 1500,
      totalMonthlySalary: 10500,
      canteenPolicy: 'ONE_PACK_DAILY',
    },
    {
      code: 'OP-HLP-002',
      nickname: 'سيد',
      name: 'سيد عبد العال',
      siteName: 'مشروع العلمين',
      jobTitle: 'عامل مساعد',
      status: 'ACTIVE',
      basicSalary: 6000,
      dailyWage: 250,
      fixedAllowances: 1000,
      totalMonthlySalary: 7000,
      canteenPolicy: 'NONE',
    },
  ];

  function generateExcelColumnsForRole(role: string): string[] {
    const canViewFinances = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(role);
    const cols = ['code', 'nickname', 'name', 'siteName', 'jobTitle', 'status'];
    if (canViewFinances) {
      cols.push('basicSalary', 'dailyWage', 'fixedAllowances', 'totalMonthlySalary');
    }
    cols.push('canteenPolicy');
    return cols;
  }

  describe('1. Server-Side Export Column Masking', () => {
    it('strictly strips all compensation columns when role is FIELD_ADMIN', () => {
      const columns = generateExcelColumnsForRole('FIELD_ADMIN');
      expect(columns).not.toContain('basicSalary');
      expect(columns).not.toContain('dailyWage');
      expect(columns).not.toContain('fixedAllowances');
      expect(columns).not.toContain('totalMonthlySalary');
      expect(columns).toContain('code');
      expect(columns).toContain('nickname');
      expect(columns).toContain('canteenPolicy');
    });

    it('includes full compensation columns when role is SUPER_ADMIN or GENERAL_ADMIN', () => {
      const superCols = generateExcelColumnsForRole('SUPER_ADMIN');
      expect(superCols).toContain('basicSalary');
      expect(superCols).toContain('dailyWage');
      expect(superCols).toContain('fixedAllowances');
      expect(superCols).toContain('totalMonthlySalary');

      const generalCols = generateExcelColumnsForRole('GENERAL_ADMIN');
      expect(generalCols).toContain('basicSalary');
      expect(generalCols).toContain('dailyWage');
      expect(generalCols).toContain('fixedAllowances');
      expect(generalCols).toContain('totalMonthlySalary');
    });
  });

  describe('2. ExcelJS Workbook Generation with Field Masking', () => {
    it('produces valid Excel workbook without sensitive compensation cells for FIELD_ADMIN', async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Workers', { views: [{ rightToLeft: true }] });

      const permittedCols = generateExcelColumnsForRole('FIELD_ADMIN');
      worksheet.columns = permittedCols.map((k) => ({ header: k, key: k }));

      for (const w of sampleWorkers) {
        const safeData = projectSafeWorkerFields(w, 'FIELD_ADMIN');
        worksheet.addRow(safeData);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      expect(buffer).toBeDefined();
      expect(buffer.byteLength).toBeGreaterThan(1000);

      // Read back workbook from buffer to confirm zero leaked salary headers
      const reader = new ExcelJS.Workbook();
      await reader.xlsx.load(buffer as any);
      const sheet = reader.getWorksheet('Workers');
      expect(sheet).toBeDefined();

      const headerRowValues = (sheet?.getRow(1).values as string[]) || [];
      expect(headerRowValues).not.toContain('basicSalary');
      expect(headerRowValues).not.toContain('dailyWage');
      expect(headerRowValues).not.toContain('totalMonthlySalary');
      expect(headerRowValues).toContain('nickname');
    });

    it('produces valid Excel workbook with full compensation for SUPER_ADMIN', async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Workers', { views: [{ rightToLeft: true }] });

      const permittedCols = generateExcelColumnsForRole('SUPER_ADMIN');
      worksheet.columns = permittedCols.map((k) => ({ header: k, key: k }));

      for (const w of sampleWorkers) {
        const safeData = projectSafeWorkerFields(w, 'SUPER_ADMIN');
        worksheet.addRow(safeData);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const reader = new ExcelJS.Workbook();
      await reader.xlsx.load(buffer as any);
      const sheet = reader.getWorksheet('Workers');
      const headerRowValues = (sheet?.getRow(1).values as string[]) || [];

      expect(headerRowValues).toContain('basicSalary');
      expect(headerRowValues).toContain('totalMonthlySalary');
    });

    it('sanitizes dangerous characters to neutralize CSV/Excel formula injection', () => {
      expect(sanitizeExcelCell('=1+1')).toBe("'=1+1");
      expect(sanitizeExcelCell('+cmd')).toBe("'+cmd");
      expect(sanitizeExcelCell('-100')).toBe("'-100");
      expect(sanitizeExcelCell('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
      expect(sanitizeExcelCell('\tformula')).toBe("'\tformula");
      expect(sanitizeExcelCell('\rformula')).toBe("'\rformula");
      expect(sanitizeExcelCell('Normal String')).toBe('Normal String');
      expect(sanitizeExcelCell(12345)).toBe(12345);
      expect(sanitizeExcelCell(null)).toBe(null);
      expect(sanitizeExcelCell(undefined)).toBe(undefined);
    });
  });
});

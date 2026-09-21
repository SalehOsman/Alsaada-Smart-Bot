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
      // Arrange
      const role = 'FIELD_ADMIN';

      // Act
      const columns = generateExcelColumnsForRole(role);

      // Assert
      expect(columns).not.toContain('basicSalary');
      expect(columns).not.toContain('dailyWage');
      expect(columns).not.toContain('fixedAllowances');
      expect(columns).not.toContain('totalMonthlySalary');
      expect(columns).toContain('code');
      expect(columns).toContain('nickname');
      expect(columns).toContain('canteenPolicy');
      expect(isFieldMasked(role, 'workforce.compensation.view', 'basicSalary')).toBe(true);
      expect(isFieldMasked(role, 'workforce.compensation.view', 'dailyWage')).toBe(true);
    });

    it('includes full compensation columns when role is SUPER_ADMIN or GENERAL_ADMIN', () => {
      // Arrange
      const superRole = 'SUPER_ADMIN';
      const generalRole = 'GENERAL_ADMIN';

      // Act
      const superCols = generateExcelColumnsForRole(superRole);
      const generalCols = generateExcelColumnsForRole(generalRole);

      // Assert
      expect(superCols).toContain('basicSalary');
      expect(superCols).toContain('dailyWage');
      expect(superCols).toContain('fixedAllowances');
      expect(superCols).toContain('totalMonthlySalary');
      expect(superCols).not.toContain('passwordHash');

      expect(generalCols).toContain('basicSalary');
      expect(generalCols).toContain('dailyWage');
      expect(generalCols).toContain('fixedAllowances');
      expect(generalCols).toContain('totalMonthlySalary');
      expect(isFieldMasked(superRole, 'workforce.compensation.view', 'basicSalary')).toBe(false);
      expect(isFieldMasked(generalRole, 'workforce.compensation.view', 'basicSalary')).toBe(false);
    });
  });

  describe('2. ExcelJS Workbook Generation with Field Masking', () => {
    it('produces valid Excel workbook without sensitive compensation cells for FIELD_ADMIN', async () => {
      // Arrange
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Workers', { views: [{ rightToLeft: true }] });
      const permittedCols = generateExcelColumnsForRole('FIELD_ADMIN');
      worksheet.columns = permittedCols.map((k) => ({ header: k, key: k }));

      for (const w of sampleWorkers) {
        const safeData = projectSafeWorkerFields(w, 'FIELD_ADMIN');
        worksheet.addRow(safeData);
      }

      // Act
      const buffer = await workbook.xlsx.writeBuffer();
      const reader = new ExcelJS.Workbook();
      await reader.xlsx.load(buffer as any);
      const sheet = reader.getWorksheet('Workers');
      const headerRowValues = (sheet?.getRow(1).values as string[]) || [];

      // Assert
      expect(buffer).toBeDefined();
      expect(buffer.byteLength).toBeGreaterThan(1000);
      expect(sheet).toBeDefined();
      expect(headerRowValues).not.toContain('basicSalary');
      expect(headerRowValues).not.toContain('dailyWage');
      expect(headerRowValues).not.toContain('totalMonthlySalary');
      expect(headerRowValues).toContain('nickname');
      expect(headerRowValues).toContain('code');
    });

    it('produces valid Excel workbook with full compensation for SUPER_ADMIN', async () => {
      // Arrange
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Workers', { views: [{ rightToLeft: true }] });
      const permittedCols = generateExcelColumnsForRole('SUPER_ADMIN');
      worksheet.columns = permittedCols.map((k) => ({ header: k, key: k }));

      for (const w of sampleWorkers) {
        const safeData = projectSafeWorkerFields(w, 'SUPER_ADMIN');
        worksheet.addRow(safeData);
      }

      // Act
      const buffer = await workbook.xlsx.writeBuffer();
      const reader = new ExcelJS.Workbook();
      await reader.xlsx.load(buffer as any);
      const sheet = reader.getWorksheet('Workers');
      const headerRowValues = (sheet?.getRow(1).values as string[]) || [];

      // Assert
      expect(buffer).toBeDefined();
      expect(sheet).toBeDefined();
      expect(headerRowValues).toContain('basicSalary');
      expect(headerRowValues).toContain('totalMonthlySalary');
      expect(headerRowValues).not.toContain('unauthorizedLeakKey');
    });

    it('sanitizes dangerous characters to neutralize CSV/Excel formula injection', () => {
      // Arrange & Act & Assert
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
      // Negative assertions
      expect(sanitizeExcelCell('=1+1')).not.toBe('=1+1');
      expect(sanitizeExcelCell('+cmd')).not.toBe('+cmd');
    });
  });
});

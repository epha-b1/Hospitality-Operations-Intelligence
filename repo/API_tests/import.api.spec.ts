import request from 'supertest';
import ExcelJS from 'exceljs';
import app from '../src/app';
import { sequelize } from '../src/config/database';
import { describeDb } from './db-guard';

let adminToken: string;

async function createTestExcel(columns: string[], rows: string[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('data');
  ws.addRow(columns);
  for (const row of rows) ws.addRow(row);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describeDb('Slice 9 — Import API', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    adminToken = (await request(app).post('/auth/login').send({ username: 'admin', password: 'Admin1!pass' })).body.accessToken;
  });
  afterAll(async () => { await sequelize.close(); });

  test('GET /import/templates/staffing 200 — downloads template', async () => {
    const res = await request(app).get('/import/templates/staffing');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheet');
  });

  test('GET /import/templates/evaluation 200', async () => {
    const res = await request(app).get('/import/templates/evaluation');
    expect(res.status).toBe(200);
  });

  test('POST /import/upload 200 — valid staffing file', async () => {
    const buf = await createTestExcel(
      ['employee_id', 'effective_date', 'position', 'department'],
      [['EMP001', '2025-06-01', 'Manager', 'Operations'], ['EMP002', '2025-06-01', 'Analyst', 'Finance']]
    );
    const res = await request(app).post('/import/upload').set('Authorization', `Bearer ${adminToken}`)
      .field('datasetType', 'staffing').attach('file', buf, 'staffing.xlsx');
    expect(res.status).toBe(200);
    expect(res.body.batchId).toBeDefined();
    expect(res.body.totalRows).toBe(2);
    expect(res.body.errorRows).toBe(0);
  });

  test('POST /import/upload 200 — file with errors', async () => {
    const buf = await createTestExcel(
      ['employee_id', 'effective_date', 'position'],
      [['', '2025-06-01', 'Manager'], ['EMP002', 'bad-date', '']]
    );
    const res = await request(app).post('/import/upload').set('Authorization', `Bearer ${adminToken}`)
      .field('datasetType', 'staffing').attach('file', buf, 'staffing-bad.xlsx');
    expect(res.status).toBe(200);
    expect(res.body.errorRows).toBeGreaterThan(0);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('POST /import/:batchId/commit 200', async () => {
    const buf = await createTestExcel(
      ['employee_id', 'effective_date', 'position'],
      [['EMP010', '2025-07-01', 'Chef']]
    );
    const upload = await request(app).post('/import/upload').set('Authorization', `Bearer ${adminToken}`)
      .field('datasetType', 'staffing').attach('file', buf, 'staffing-commit.xlsx');
    const res = await request(app).post(`/import/${upload.body.batchId}/commit`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  test('GET /import/:batchId 200 — batch status', async () => {
    const buf = await createTestExcel(['employee_id', 'effective_date', 'position'], [['EMP020', '2025-08-01', 'Host']]);
    const upload = await request(app).post('/import/upload').set('Authorization', `Bearer ${adminToken}`)
      .field('datasetType', 'staffing').attach('file', buf, 'status.xlsx');
    const res = await request(app).get(`/import/${upload.body.batchId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.batch_type).toBe('staffing');
  });
});

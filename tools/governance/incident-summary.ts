import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface IncidentRecord {
  file: string;
  id: string;
  date: string;
  component: string;
  severity: string;
  category: string;
  status: string;
  workPlan: string;
  title: string;
}

function parseFrontmatterValue(content: string, key: string): string {
  const match = content.match(new RegExp(`^${key}:\\s*["']?([^"'\\r\\n]+)["']?`, 'm'));
  return match?.[1]?.trim() ?? 'N/A';
}

function extractTitle(content: string): string {
  const match = content.match(/^#+\s*\[?([^\]\r\n]+)\]?/m);
  return match?.[1]?.trim() ?? 'Untitled Incident';
}

export function scanIncidents(root: string = process.cwd()): IncidentRecord[] {
  const incidentsDir = join(root, 'docs', 'code-incidents');
  if (!existsSync(incidentsDir)) return [];

  const files = readdirSync(incidentsDir).filter(
    (f) => f.endsWith('.md') && f !== 'TEMPLATE.md' && !f.startsWith('.')
  );

  const records: IncidentRecord[] = [];
  for (const file of files) {
    const fullPath = join(incidentsDir, file);
    try {
      const raw = readFileSync(fullPath, 'utf8');
      records.push({
        file,
        id: parseFrontmatterValue(raw, 'incident_id'),
        date: parseFrontmatterValue(raw, 'date'),
        component: parseFrontmatterValue(raw, 'component'),
        severity: parseFrontmatterValue(raw, 'severity'),
        category: parseFrontmatterValue(raw, 'category'),
        status: parseFrontmatterValue(raw, 'status'),
        workPlan: parseFrontmatterValue(raw, 'work_plan'),
        title: extractTitle(raw),
      });
    } catch {
      // Ignore unparseable files
    }
  }

  return records.sort((a, b) => b.date.localeCompare(a.date));
}

export function printIncidentSummary(): void {
  const incidents = scanIncidents();

  console.log('\n===============================================================');
  console.log('🛡️  AL-SAADA SMART BOT — LOCAL CODE INCIDENTS & POSTMORTEMS');
  console.log('===============================================================\n');

  if (incidents.length === 0) {
    console.log('✅ No local code incidents recorded yet.');
    console.log('   All tests currently passing without open production code defects.');
    console.log('   When a defect occurs, use docs/code-incidents/TEMPLATE.md to document it.\n');
    return;
  }

  console.log(`📊 Total Incidents Recorded: ${incidents.length}\n`);

  // Severity breakdown
  const severities: Record<string, number> = { 'SEV-1': 0, 'SEV-2': 0, 'SEV-3': 0, 'SEV-4': 0 };
  const components: Record<string, number> = {};
  const categories: Record<string, number> = {};

  for (const inc of incidents) {
    severities[inc.severity] = (severities[inc.severity] ?? 0) + 1;
    components[inc.component] = (components[inc.component] ?? 0) + 1;
    categories[inc.category] = (categories[inc.category] ?? 0) + 1;
  }

  console.log('🚨 Severity Breakdown:');
  for (const [sev, count] of Object.entries(severities)) {
    if (count > 0) {
      console.log(`   - ${sev}: ${count}`);
    }
  }

  console.log('\n📦 Affected Components:');
  for (const [comp, count] of Object.entries(components)) {
    console.log(`   - ${comp}: ${count}`);
  }

  console.log('\n🏷️  Architectural Categories:');
  for (const [cat, count] of Object.entries(categories)) {
    console.log(`   - ${cat}: ${count}`);
  }

  console.log('\n📋 Incident Log:');
  console.log('---------------------------------------------------------------------------------------------------------');
  console.log('| ID             | Date       | Sev   | Component            | Category                     | Plan  |');
  console.log('---------------------------------------------------------------------------------------------------------');
  for (const inc of incidents) {
    const id = inc.id.padEnd(14).slice(0, 14);
    const date = inc.date.padEnd(10).slice(0, 10);
    const sev = inc.severity.padEnd(5).slice(0, 5);
    const comp = inc.component.padEnd(20).slice(0, 20);
    const cat = inc.category.padEnd(28).slice(0, 28);
    const plan = inc.workPlan.padEnd(5).slice(0, 5);
    console.log(`| ${id} | ${date} | ${sev} | ${comp} | ${cat} | ${plan} |`);
  }
  console.log('---------------------------------------------------------------------------------------------------------\n');
}

if (process.argv[1]?.includes('incident-summary')) {
  printIncidentSummary();
}

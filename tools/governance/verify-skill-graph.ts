import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createResult,
  fail,
  isCliEntrypoint,
  printAndExit,
  type VerificationResult,
} from './common.js';
import { JEV_AUDIT_CATALOG } from './typesafe/audit-catalog.js';

export const EXPECTED_SKILL_IDS = [
  'saleh',
  'jev',
  'chief-arbitrator',
  'open-code-review',
  'squad-architecture-devops',
  'squad-finance-security',
  'squad-implementation-ux',
  'squad-qa-migration',
  'clean-code-guard',
  'test-guard',
  'docs-guard',
] as const;

export type SkillCategory =
  | 'sovereign_auditor'
  | 'arbitrator'
  | 'static_reviewer'
  | 'execution_squad'
  | 'arsenal_guard';

export interface SkillNode {
  skillId: string;
  category: SkillCategory;
  title: string;
  skillFilePath: string;
  coreCompetencies: string[];
  linkedRulebooks: string[];
  linkedWorkPlans: string[];
  enforcedQualityGates: string[];
  jevConsultationQuestions: string[];
  preTaskChecklist: string[];
  postTaskChecklist: string[];
}

export interface SovereignSkillGraph {
  $schema?: string;
  version: string;
  generatedAt: string;
  totalSkills: number;
  skills: SkillNode[];
}

export const VALID_GATES = Array.from({ length: 23 }, (_, i) => `G${i + 1}`);

export function readSkillGraph(root = process.cwd()): SovereignSkillGraph {
  const graphPath = join(root, '.agents', 'knowledge', 'sovereign-skill-graph.json');
  if (!existsSync(graphPath)) {
    throw new Error(`Sovereign skill graph not found at: ${graphPath}`);
  }
  const raw = readFileSync(graphPath, 'utf8');
  const parsed = JSON.parse(raw);
  return validateSkillGraphData(parsed);
}

function validateSkillGraphData(data: unknown): SovereignSkillGraph {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Skill graph root must be an object');
  }
  const obj = data as Record<string, any>;
  if (typeof obj.version !== 'string') throw new Error('Skill graph version must be a string');
  if (typeof obj.totalSkills !== 'number' || obj.totalSkills < 11) {
    throw new Error('Skill graph totalSkills must be a number >= 11');
  }
  if (!Array.isArray(obj.skills) || obj.skills.length !== 11) {
    throw new Error('Skill graph skills array must contain exactly 11 skills');
  }

  for (const s of obj.skills) {
    if (!s || typeof s !== 'object') throw new Error('Skill item must be an object');
    if (!s.skillId || typeof s.skillId !== 'string') throw new Error('Skill must have a valid skillId');
    if (!s.category || typeof s.category !== 'string') throw new Error(`Skill [${s.skillId}] missing category`);
    if (!s.title || typeof s.title !== 'string') throw new Error(`Skill [${s.skillId}] missing title`);
    if (!s.skillFilePath || typeof s.skillFilePath !== 'string') throw new Error(`Skill [${s.skillId}] missing skillFilePath`);
    if (!Array.isArray(s.coreCompetencies) || s.coreCompetencies.length === 0) {
      throw new Error(`Skill [${s.skillId}] must have non-empty coreCompetencies`);
    }
    if (!Array.isArray(s.linkedRulebooks) || s.linkedRulebooks.length === 0) {
      throw new Error(`Skill [${s.skillId}] must have non-empty linkedRulebooks`);
    }
    if (!Array.isArray(s.linkedWorkPlans) || s.linkedWorkPlans.length === 0) {
      throw new Error(`Skill [${s.skillId}] must have non-empty linkedWorkPlans`);
    }
    if (!Array.isArray(s.enforcedQualityGates) || s.enforcedQualityGates.length === 0) {
      throw new Error(`Skill [${s.skillId}] must have non-empty enforcedQualityGates`);
    }
    if (!Array.isArray(s.jevConsultationQuestions) || s.jevConsultationQuestions.length === 0) {
      throw new Error(`Skill [${s.skillId}] must have non-empty jevConsultationQuestions`);
    }
    if (!Array.isArray(s.preTaskChecklist) || s.preTaskChecklist.length === 0) {
      throw new Error(`Skill [${s.skillId}] must have non-empty preTaskChecklist`);
    }
    if (!Array.isArray(s.postTaskChecklist) || s.postTaskChecklist.length === 0) {
      throw new Error(`Skill [${s.skillId}] must have non-empty postTaskChecklist`);
    }
  }

  return obj as SovereignSkillGraph;
}

export function verifySkillGraph(root = process.cwd()): VerificationResult {
  const result = createResult();
  const graphPath = join(root, '.agents', 'knowledge', 'sovereign-skill-graph.json');

  result.checked++;
  if (!existsSync(graphPath)) {
    fail(result, `Missing sovereign skill graph at: ${graphPath}`);
    return result;
  }

  let graph: SovereignSkillGraph;
  try {
    const raw = readFileSync(graphPath, 'utf8');
    graph = validateSkillGraphData(JSON.parse(raw));
  } catch (err: any) {
    fail(result, `Skill graph schema validation failed: ${err.message}`);
    return result;
  }

  // 1. Check all expected skills are present
  const registeredSkillIds = new Set(graph.skills.map((s) => s.skillId));
  for (const expectedId of EXPECTED_SKILL_IDS) {
    result.checked++;
    if (!registeredSkillIds.has(expectedId)) {
      fail(result, `Missing expected skill [${expectedId}] in sovereign-skill-graph.json`);
    }
  }

  // 2. Discover physical skills on disk to guarantee Zero Orphan Skills
  const physicalSkillIds = new Set<string>();
  const skillsBaseDir = join(root, '.agents', 'skills');
  if (existsSync(skillsBaseDir)) {
    for (const entry of readdirSync(skillsBaseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'saleh') {
        physicalSkillIds.add('saleh');
        const arsenalDir = join(skillsBaseDir, 'saleh', 'arsenal');
        if (existsSync(arsenalDir)) {
          for (const aEntry of readdirSync(arsenalDir, { withFileTypes: true })) {
            if (aEntry.isDirectory()) {
              physicalSkillIds.add(aEntry.name);
            }
          }
        }
      } else {
        physicalSkillIds.add(entry.name);
      }
    }
  }

  for (const physId of physicalSkillIds) {
    result.checked++;
    if (!registeredSkillIds.has(physId as any)) {
      fail(result, `Orphan physical skill detected: [${physId}] is on disk but not in sovereign-skill-graph.json`);
    }
  }

  // 3. Verify each registered skill
  const rulesDir = join(root, '.agents', 'rules');
  const availableRuleFiles = existsSync(rulesDir) ? readdirSync(rulesDir) : [];

  const workPlansDir = join(root, 'docs', 'work-plans');
  const availableWorkPlanFiles = existsSync(workPlansDir) ? readdirSync(workPlansDir) : [];

  for (const skill of graph.skills) {
    // 3.1 Verify skillFilePath physically exists
    result.checked++;
    const absSkillPath = join(root, skill.skillFilePath);
    if (!existsSync(absSkillPath)) {
      fail(result, `Skill [${skill.skillId}] file does not exist physically: ${skill.skillFilePath}`);
    }

    // 3.2 Verify linked rulebooks exist
    for (const rbNum of skill.linkedRulebooks) {
      result.checked++;
      const prefix = rbNum.padStart(2, '0') + '-';
      const found = availableRuleFiles.some((f) => f.startsWith(prefix) && f.endsWith('.md'));
      if (!found) {
        fail(result, `Skill [${skill.skillId}] references non-existent rulebook [${rbNum}]`);
      }
    }

    // 3.3 Verify linked work plans exist
    for (const wpNum of skill.linkedWorkPlans) {
      result.checked++;
      const prefix = wpNum.padStart(2, '0') + '-';
      const found = availableWorkPlanFiles.some((f) => f.startsWith(prefix) && f.endsWith('.md'));
      if (!found) {
        fail(result, `Skill [${skill.skillId}] references non-existent work plan [${wpNum}]`);
      }
    }

    // 3.4 Verify quality gates
    for (const gate of skill.enforcedQualityGates) {
      result.checked++;
      if (!VALID_GATES.includes(gate)) {
        fail(result, `Skill [${skill.skillId}] references invalid quality gate [${gate}]`);
      }
    }

    // 3.5 Verify JEV questions exist in JEV_AUDIT_CATALOG
    for (const questionPath of skill.jevConsultationQuestions) {
      result.checked++;
      const [category, question] = questionPath.split('.');
      if (!category || !question) {
        fail(result, `Skill [${skill.skillId}] has invalid question format [${questionPath}]`);
        continue;
      }
      const catObj = (JEV_AUDIT_CATALOG as Record<string, Record<string, unknown>>)[category];
      if (!catObj || !catObj[question]) {
        fail(result, `Skill [${skill.skillId}] references unknown JEV question [${questionPath}]`);
      }
    }
  }

  return result;
}

export interface TaskQueryOptions {
  skillIds?: string[] | undefined;
  rulebooks?: string[] | undefined;
  gates?: string[] | undefined;
  root?: string | undefined;
}

export interface TaskRequirementsSummary {
  skills: SkillNode[];
  allRulebooks: string[];
  allGates: string[];
  allWorkPlans: string[];
  preTaskChecklist: string[];
  postTaskChecklist: string[];
  jevQuestions: string[];
}

export function querySkillGraphForTask(options: TaskQueryOptions): TaskRequirementsSummary {
  const graph = readSkillGraph(options.root);
  const targetSkillIds = new Set(options.skillIds ?? graph.skills.map((s) => s.skillId));

  if (options.skillIds && options.skillIds.length > 0) {
    const knownIds = new Set(graph.skills.map((s) => s.skillId));
    const unknown = options.skillIds.filter((id) => !knownIds.has(id));
    if (unknown.length > 0) {
      throw new Error(
        `Unrecognized skill ID(s) in query: ${unknown.join(', ')}. Must be one of: ${Array.from(knownIds).join(', ')}`
      );
    }
  }

  const matchedSkills = graph.skills.filter((s) => {
    if (targetSkillIds.has(s.skillId)) return true;
    if (options.rulebooks && s.linkedRulebooks.some((rb) => options.rulebooks!.includes(rb))) return true;
    if (options.gates && s.enforcedQualityGates.some((g) => options.gates!.includes(g))) return true;
    return false;
  });

  const rulebooksSet = new Set<string>();
  const gatesSet = new Set<string>();
  const workPlansSet = new Set<string>();
  const preChecklistSet = new Set<string>();
  const postChecklistSet = new Set<string>();
  const jevQuestionsSet = new Set<string>();

  for (const s of matchedSkills) {
    for (const rb of s.linkedRulebooks) rulebooksSet.add(rb);
    for (const g of s.enforcedQualityGates) gatesSet.add(g);
    for (const wp of s.linkedWorkPlans) workPlansSet.add(wp);
    for (const pre of s.preTaskChecklist) preChecklistSet.add(pre);
    for (const post of s.postTaskChecklist) postChecklistSet.add(post);
    for (const jq of s.jevConsultationQuestions) jevQuestionsSet.add(jq);
  }

  return {
    skills: matchedSkills,
    allRulebooks: Array.from(rulebooksSet).sort(),
    allGates: Array.from(gatesSet).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1))),
    allWorkPlans: Array.from(workPlansSet).sort(),
    preTaskChecklist: Array.from(preChecklistSet),
    postTaskChecklist: Array.from(postChecklistSet),
    jevQuestions: Array.from(jevQuestionsSet),
  };
}

if (isCliEntrypoint(import.meta.url)) {
  const result = verifySkillGraph();
  printAndExit('Sovereign Skill Graph & 11-Skill Knowledge Base', result);
}

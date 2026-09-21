import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isCliEntrypoint, normalized, toRepoPath } from "./common.js";

export interface FlowTopologyEntry {
  flowKey: string;
  flowSlug: string;
  module: string;
  directory: string;
  files: string[];
  models: string[];
  tests: string[];
}

export interface PackageTopologyEntry {
  name: string;
  directory: string;
  main?: string | undefined;
  dependencies: string[];
}

export interface SystemTopology {
  schemaVersion: 1;
  generatedAt: string;
  totalFlows: number;
  totalModules: number;
  totalPackages: number;
  totalApps: number;
  flows: Record<string, FlowTopologyEntry>;
  modules: Record<string, { name: string; directory: string; flows: string[] }>;
  packages: Record<string, PackageTopologyEntry>;
  apps: Record<string, { name: string; directory: string }>;
}

export function extractPrismaModels(content: string): string[] {
  const models = new Set<string>();
  const prismaRegex = /prisma\.([a-zA-Z0-9]+)\b/g;
  let match: RegExpExecArray | null;
  while ((match = prismaRegex.exec(content)) !== null) {
    if (
      match[1] &&
      ![
        "$connect",
        "$disconnect",
        "$transaction",
        "$executeRaw",
        "$queryRaw",
        "$use",
      ].includes(match[1])
    ) {
      models.add(match[1]);
    }
  }
  return [...models].sort();
}

export function generateTopology(root = process.cwd()): SystemTopology {
  const flows: Record<string, FlowTopologyEntry> = {};
  const modules: Record<
    string,
    { name: string; directory: string; flows: string[] }
  > = {};
  const packages: Record<string, PackageTopologyEntry> = {};
  const apps: Record<string, { name: string; directory: string }> = {};

  // 1. Scan Modules and Flows
  const modulesDir = join(root, "modules");
  if (existsSync(modulesDir)) {
    for (const modEntry of readdirSync(modulesDir, { withFileTypes: true })) {
      if (!modEntry.isDirectory()) continue;
      const modName = modEntry.name;
      const modPath = join(modulesDir, modName);
      const modRelPath = normalized(toRepoPath(root, modPath));
      const flowKeys: string[] = [];

      const flowsDir = join(modPath, "src", "flows");
      if (existsSync(flowsDir)) {
        for (const flowEntry of readdirSync(flowsDir, {
          withFileTypes: true,
        })) {
          if (!flowEntry.isDirectory()) continue;
          const flowSlug = flowEntry.name;
          const flowDir = join(flowsDir, flowSlug);
          const flowRelDir = normalized(toRepoPath(root, flowDir));

          let flowKey = flowSlug.split("-")[0] ?? flowSlug;
          const files: string[] = [];
          const modelsSet = new Set<string>();

          for (const file of readdirSync(flowDir)) {
            const filePath = join(flowDir, file);
            const relFile = normalized(toRepoPath(root, filePath));
            files.push(relFile);

            if (file === "flow.contract.json") {
              try {
                const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
                  flowKey?: string;
                  relatedModels?: string[];
                };
                if (parsed.flowKey) flowKey = parsed.flowKey;
                if (Array.isArray(parsed.relatedModels)) {
                  parsed.relatedModels.forEach((m) => modelsSet.add(m));
                }
              } catch {
                // ignore
              }
            }

            if (file.endsWith(".ts") || file.endsWith(".js")) {
              try {
                const code = readFileSync(filePath, "utf8");
                extractPrismaModels(code).forEach((m) => modelsSet.add(m));
              } catch {
                // ignore
              }
            }
          }

          // Search tests for this flow
          const tests: string[] = [];
          const modTestsDir = join(modPath, "tests");
          if (existsSync(modTestsDir)) {
            const scanTests = (dir: string): void => {
              for (const e of readdirSync(dir, { withFileTypes: true })) {
                const p = join(dir, e.name);
                if (e.isDirectory()) scanTests(p);
                else if (
                  e.name.includes(flowKey) ||
                  e.name.includes(flowSlug)
                ) {
                  tests.push(normalized(toRepoPath(root, p)));
                }
              }
            };
            scanTests(modTestsDir);
          }

          flows[flowKey] = {
            flowKey,
            flowSlug,
            module: modName,
            directory: flowRelDir,
            files: files.sort(),
            models: [...modelsSet].sort(),
            tests: tests.sort(),
          };

          flowKeys.push(flowKey);
        }
      }

      modules[modName] = {
        name: modName,
        directory: modRelPath,
        flows: flowKeys.sort(),
      };
    }
  }

  // 2. Scan Packages
  const packagesDir = join(root, "packages");
  if (existsSync(packagesDir)) {
    for (const pkgEntry of readdirSync(packagesDir, { withFileTypes: true })) {
      if (!pkgEntry.isDirectory()) continue;
      const pkgPath = join(packagesDir, pkgEntry.name);
      const pkgJsonPath = join(pkgPath, "package.json");
      if (existsSync(pkgJsonPath)) {
        try {
          const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as {
            name?: string;
            main?: string;
            dependencies?: Record<string, string>;
          };
          packages[pkgJson.name ?? pkgEntry.name] = {
            name: pkgJson.name ?? pkgEntry.name,
            directory: normalized(toRepoPath(root, pkgPath)),
            main: pkgJson.main,
            dependencies: Object.keys(pkgJson.dependencies ?? {}).sort(),
          };
        } catch {
          // ignore
        }
      }
    }
  }

  // 3. Scan Apps
  const appsDir = join(root, "apps");
  if (existsSync(appsDir)) {
    for (const appEntry of readdirSync(appsDir, { withFileTypes: true })) {
      if (!appEntry.isDirectory()) continue;
      const appPath = join(appsDir, appEntry.name);
      apps[appEntry.name] = {
        name: appEntry.name,
        directory: normalized(toRepoPath(root, appPath)),
      };
    }
  }

  const topology: SystemTopology = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    totalFlows: Object.keys(flows).length,
    totalModules: Object.keys(modules).length,
    totalPackages: Object.keys(packages).length,
    totalApps: Object.keys(apps).length,
    flows,
    modules,
    packages,
    apps,
  };

  return topology;
}

export function writeTopology(
  root = process.cwd(),
  outputPath = join(root, ".agents", "topology.json"),
): void {
  const topology = generateTopology(root);
  writeFileSync(outputPath, JSON.stringify(topology, null, 2) + "\n", "utf8");
}

if (isCliEntrypoint(import.meta.url)) {
  const root = process.cwd();
  writeTopology(root);
  console.log("Topology generated successfully: .agents/topology.json");
}

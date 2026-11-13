import { db } from "@/db/client";
import { projectTypes } from "@/db/schema";

const projectTypeSeeds = [
  {
    id: "web-app",
    name: "Web application",
    description: "A web application project.",
  },
  {
    id: "micro-saas",
    name: "Micro SaaS",
    description: "A small software-as-a-service product.",
  },
  {
    id: "data-pipeline",
    name: "Data pipeline",
    description: "A project for processing and moving data.",
  },
  {
    id: "library",
    name: "Library",
    description: "A reusable software library.",
  },
  {
    id: "other",
    name: "Other",
    description: "A project that does not match another template.",
  },
] as const;

export function seedProjectTypes(): void {
  db.insert(projectTypes)
    .values(
      projectTypeSeeds.map((projectType) => ({
        ...projectType,
        defaultChecks: "[]",
        defaultStepTitles: "[]",
      })),
    )
    .onConflictDoNothing()
    .run();
}

seedProjectTypes();

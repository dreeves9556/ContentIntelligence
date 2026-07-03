import { prisma } from "../src/lib/prisma";
import type { QuestionnaireFormData } from "../src/lib/questionnaire-actions";
import { buildMemoriesFromQuestionnaire, buildMemoriesFromSurvey } from "../src/lib/memory/memory-builder";

async function main() {
  console.log("=== Memory Backfill Script ===\n");

  // 1. Find all users with questionnaires
  const questionnaires = await prisma.questionnaire.findMany({
    select: {
      id: true,
      userId: true,
      content: true,
    },
  });

  console.log(`Found ${questionnaires.length} questionnaire(s) to process.\n`);

  let totalMemories = 0;
  let usersProcessed = 0;

  for (const q of questionnaires) {
    try {
      const answers = q.content as unknown as QuestionnaireFormData;
      if (!answers || typeof answers !== "object") {
        console.log(`  [SKIP] Questionnaire ${q.id} has invalid content`);
        continue;
      }

      const count = await buildMemoriesFromQuestionnaire(q.userId, answers);
      totalMemories += count;
      usersProcessed++;
      console.log(`  [OK] User ${q.userId}: ${count} memories from questionnaire`);
    } catch (err) {
      console.error(`  [ERROR] User ${q.userId}:`, err);
    }
  }

  console.log(`\n--- Questionnaire backfill complete: ${usersProcessed} users, ${totalMemories} memories ---\n`);

  // 2. Find all profile surveys and build memories from them
  const surveys = await prisma.profileSurvey.findMany({
    select: {
      id: true,
      userId: true,
      surveyType: true,
      answersJson: true,
    },
  });

  console.log(`Found ${surveys.length} profile survey(s) to process.\n`);

  let surveyMemories = 0;

  for (const survey of surveys) {
    try {
      const answers = survey.answersJson as unknown as Record<string, string>;
      if (!answers || typeof answers !== "object") {
        console.log(`  [SKIP] Survey ${survey.id} has invalid content`);
        continue;
      }

      const count = await buildMemoriesFromSurvey(survey.userId, survey.surveyType, answers);
      surveyMemories += count;
      console.log(`  [OK] User ${survey.userId} (${survey.surveyType}): ${count} memories`);
    } catch (err) {
      console.error(`  [ERROR] Survey ${survey.id}:`, err);
    }
  }

  console.log(`\n--- Survey backfill complete: ${surveyMemories} memories ---\n`);

  // 3. Summary
  const totalInDb = await prisma.creatorMemory.count();
  console.log(`=== Backfill Complete ===`);
  console.log(`Total memories now in database: ${totalInDb}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});

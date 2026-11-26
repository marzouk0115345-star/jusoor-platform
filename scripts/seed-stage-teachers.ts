import 'dotenv/config';
import { ensureSeeded } from '../src/server/seed.ts';
import {
  ensureStageSpecificDemoTeachersSeeded,
  runCoverageAudit,
} from '../src/server/demoTeachersSeed.ts';
import { pool } from '../src/db/index.ts';

async function main() {
  console.log('1. Ensuring base JUSOOR data and Egyptian curriculum are seeded...');
  await ensureSeeded();

  console.log('2. Seeding stage-specific and subject-specific demo teachers...');
  const seedStats = await ensureStageSpecificDemoTeachersSeeded();
  console.log('Seed summary:', JSON.stringify(seedStats));

  console.log('3. Running full curriculum coverage & stage isolation audit...');
  const audit = await runCoverageAudit();

  console.log('');
  console.log('=== COVERAGE AUDIT SUMMARY ===');
  console.log(`Academic Year: ${audit.academicYearCode} (${audit.versionCode})`);
  console.log(`Total Active Curriculum Contexts: ${audit.totalContexts}`);
  console.log(`COMPLETE (>= 3 teachers):        ${audit.completeContexts}`);
  console.log(`INCOMPLETE (< 3 teachers):       ${audit.incompleteContexts}`);
  console.log(`Total Demo Teacher Profiles:     ${audit.totalDemoTeachers}`);
  console.log(`Distinct Active Stage Teachers:  ${audit.totalStageTeacherProfiles}`);
  console.log(`Total Active Assignments:        ${audit.totalActiveAssignments}`);
  console.log(`Cross-Stage Isolation Errors:    ${audit.crossStageViolations.length}`);

  if (audit.crossStageViolations.length > 0) {
    console.error('Cross-stage violations:', JSON.stringify(audit.crossStageViolations, null, 2));
  }

  console.log('');
  console.log('Stage | Grade | System | Division/Pathway | Subject | Distinct Active Teachers | Status');
  console.log('---|---|---|---|---|---|---');
  for (const r of audit.rows) {
    const divOrPath = r.divisionCode || r.pathwayCode || '-';
    console.log(
      `${r.stageSlug} | ${r.gradeSlug} | ${r.systemCode} | ${divOrPath} | ${r.subjectSlug} (${r.subjectNameAr}) | ${r.distinctActiveTeachers} | ${r.status}`
    );
  }

  if (audit.incompleteContexts > 0 || audit.crossStageViolations.length > 0) {
    console.error('\nAudit FAILED: Incomplete contexts or cross-stage violations detected.');
    process.exitCode = 1;
  } else {
    console.log('\nAudit PASSED: 100% COMPLETE with strict stage isolation.');
  }
}

main()
  .catch((err) => {
    console.error('Seed script failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

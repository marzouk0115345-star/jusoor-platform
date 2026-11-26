import 'dotenv/config';
import { ensureAllTeacherAssignmentSessionsSeeded } from '../src/server/sessionsSeed.ts';

async function main() {
  const result = await ensureAllTeacherAssignmentSessionsSeeded({
    includeAuditDetails: true,
  });

  console.log('=== JUSOOR Teacher Sessions Seeding & Audit Report ===');
  console.log(`Active Teaching Assignments Processed: ${result.assignmentsProcessed}`);
  console.log(`Inserted New Sessions:                 ${result.insertedSessionsCount}`);
  console.log(`Adopted Legacy Demo Sessions:          ${result.adoptedLegacySessionsCount}`);
  console.log(`Total Assignment Demo Sessions:        ${result.totalAssignmentSessionsAfter}`);
  console.log(`COMPLETE Assignments (7+7+7):          ${result.completeAssignmentsCount}`);
  console.log(`INCOMPLETE Assignments:                ${result.incompleteAssignmentsCount}`);
  console.log(`Per-Teacher Time Overlap Conflicts:    ${result.overlapConflictsDetected}`);

  const incomplete = result.auditSample.filter((r) => r.status === 'INCOMPLETE');
  if (incomplete.length > 0) {
    console.log('\n--- Incomplete Assignments ---');
    for (const row of incomplete.slice(0, 20)) {
      console.log(
        `[INCOMPLETE] Assignment #${row.assignmentId} | ${row.teacherName} | ${row.gradeNameAr} | ${row.subjectNameAr} -> OnlineGrp=${row.onlineGroupCount}, Online1on1=${row.onlineOneToOneCount}, OfflineGrp=${row.offlineGroupCount}`
      );
    }
  } else {
    console.log('\nSample Verification (first 12 assignments):');
    for (const row of result.auditSample.slice(0, 12)) {
      const ctx = row.divisionNameAr || row.pathwayNameAr || row.systemNameAr;
      console.log(
        `[COMPLETE] #${row.assignmentId} | ${row.teacherName} | ${row.gradeNameAr} (${ctx}) | ${row.subjectNameAr} -> 7 Online Grp / 7 Online 1:1 / 7 Offline Grp`
      );
    }
  }

  if (result.incompleteAssignmentsCount > 0 || result.overlapConflictsDetected > 0) {
    process.exitCode = 1;
  }
}

main()
  .then(() => process.exit())
  .catch((err) => {
    console.error('Session seeding failed:', err);
    process.exit(1);
  });

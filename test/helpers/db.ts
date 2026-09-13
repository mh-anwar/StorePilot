import prisma from "../../app/db.server";

/** Empties every table between tests (children first). */
export async function resetDb() {
  await prisma.activity.deleteMany();
  await prisma.evidenceDraft.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.usageCounter.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.gdprRequest.deleteMany();
  await prisma.session.deleteMany();
}

export { prisma };

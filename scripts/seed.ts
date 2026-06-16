import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const USERS = [
  { username: "admin", displayName: "ผู้ดูแลระบบ", password: "admin1234", role: "ADMIN" as const },
  { username: "head1", displayName: "หัวหน้าทีม 1", password: "head1234", role: "SUPERVISOR" as const },
  { username: "agent1", displayName: "พนักงาน 1", password: "agent1234", role: "AGENT" as const },
  { username: "agent2", displayName: "พนักงาน 2", password: "agent1234", role: "AGENT" as const },
];

async function main() {
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      update: { displayName: u.displayName, role: u.role },
      create: {
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        passwordHash,
      },
    });
    console.log(`✓ user ${u.username} (${u.role})`);
  }
  console.log("seed เสร็จแล้ว");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("test1234", 10);

  const testUser = await prisma.user.upsert({
    where: { email: "test@coreos.app" },
    update: {},
    create: {
      email: "test@coreos.app",
      name: "Test Client",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  const dylanUser = await prisma.user.upsert({
    where: { email: "dylan@coreos.app" },
    update: {},
    create: {
      email: "dylan@coreos.app",
      name: "Dylan Ballard",
      password: hashedPassword,
      role: "USER",
    },
  });

  console.log(`✓ Seed complete — test user: ${testUser.email} (id: ${testUser.id})`);
  console.log(`✓ Dylan Ballard: ${dylanUser.email} (id: ${dylanUser.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

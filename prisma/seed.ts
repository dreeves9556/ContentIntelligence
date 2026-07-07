import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("test1234", 10);

  const testUser = await prisma.user.upsert({
    where: { email: "daniel.reevesky@gmail.com" },
    update: {},
    create: {
      email: "daniel.reevesky@gmail.com",
      name: "Daniel Reeves",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  const dylanUser = await prisma.user.upsert({
    where: { email: "dylanballard@kw.com" },
    update: {},
    create: {
      email: "dylanballard@kw.com",
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

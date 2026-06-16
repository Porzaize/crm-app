import { setSetting, SETTING_KEYS } from "../src/lib/telegram";
import { prisma } from "../src/lib/db";

async function main() {
  await setSetting(SETTING_KEYS.teamChatId, "-5187867811"); // CRM แจ้งเตือน = ทีม
  await setSetting(SETTING_KEYS.headChatId, "-5211475505"); // CRM_MNG = หัวหน้า
  const all = await prisma.notificationSetting.findMany({ orderBy: { key: "asc" } });
  console.log("ตั้งค่าแล้ว:");
  for (const s of all) console.log(`  ${s.key} = ${s.value}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

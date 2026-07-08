import { prisma } from "../src/lib/prisma.js";

async function run() {
  const ticket = await prisma.ticket.findUnique({
    where: { id: "cmrc6k4ra000132p60r3tpz4y" },
    include: { replies: true }
  });
  console.log("Ticket Status:", ticket?.status);
  console.log("Ticket Category:", ticket?.category);
  if (ticket?.replies?.length) {
    console.log("Reply:", ticket.replies[0].body);
  }
}
run();

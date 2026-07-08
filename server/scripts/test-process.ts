import { boss, startBoss } from "./src/lib/boss.js";
import { enqueueProcessTicket, registerProcessTicketWorker } from "./src/jobs/processTicket.js";
import { prisma } from "./src/lib/prisma.js";

async function run() {
  console.log("Starting test script...");
  await startBoss();
  
  // Register the worker so it can pick up the job immediately
  await registerProcessTicketWorker();
  
  console.log("Creating a test ticket in the database...");
  const ticket = await prisma.ticket.create({
    data: {
      subject: "Question about text vectorization",
      body: "Can you tell me about the sample text for vectorization? I want to know more about it.",
      status: "NEW",
    }
  });

  console.log(`Created ticket with ID: ${ticket.id}`);
  
  console.log("Enqueueing process-ticket job...");
  const jobId = await enqueueProcessTicket({
    ticketId: ticket.id,
    subject: ticket.subject,
    body: ticket.body
  });
  console.log(`Job enqueued with ID: ${jobId}`);

  console.log("Waiting for worker to process...");
  
  // Poll the database to see the ticket's final status and any AI replies
  let attempts = 0;
  const interval = setInterval(async () => {
    attempts++;
    const updatedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { replies: true }
    });
    
    if (updatedTicket && updatedTicket.status !== "PROCESSING" && updatedTicket.status !== "NEW") {
      console.log(`\nTicket processing finished! Final Status: ${updatedTicket.status}`);
      if (updatedTicket.replies.length > 0) {
        console.log(`AI Reply: \n${updatedTicket.replies[0].body}`);
      } else {
        console.log("No AI reply generated.");
      }
      
      clearInterval(interval);
      await boss.stop();
      await prisma.$disconnect();
      process.exit(0);
    } else if (attempts > 30) {
      console.log("\nTimeout waiting for processing.");
      clearInterval(interval);
      await boss.stop();
      await prisma.$disconnect();
      process.exit(1);
    }
  }, 1000);
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

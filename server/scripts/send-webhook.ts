/// <reference types="bun-types" />

async function run() {
  const url = "http://localhost:3000/api/webhooks/inbound-email";
  
  // Set the secret for development/testing if it's not set in .env
  const secret = process.env.INBOUND_WEBHOOK_SECRET || "dev-webhook-secret";

  const payload = {
    fromEmail: "customer@example.com",
    fromName: "Rumesh Chathuranga",
    subject: "Question about refund policy",
    body: "What is the refund policy?",
    messageId: "msg-" + Date.now()
  };

  console.log(`Sending webhook to ${url}...`);
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("Status:", response.status);
    console.log("Response:", data);
  } catch (error) {
    console.error("Error sending webhook:", error);
  }
}

run();

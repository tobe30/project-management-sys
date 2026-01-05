import 'dotenv/config';
import sendEmail from "./configs/nodemailer.js";

(async () => {
  try {
    console.log("Sending test email...");
    const response = await sendEmail({
      to: "malzstores@gmail.com",  // <-- put your real email here
      subject: "Test Email",
      body: "<p>Hello! This is a test.</p>",
    });
    console.log("Test email sent!", response);
  } catch (err) {
    console.error("Error sending test email:", err);
  }
})();

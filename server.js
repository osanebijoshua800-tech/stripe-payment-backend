const express = require('express');
const cors = require('cors');
require('dotenv').config();


// Initialize Stripe with your Secret Key from the .env file
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

// -----------------------------------------------------------------------------
// 1. THE WEBHOOK ENDPOINT (Must come BEFORE express.json() middleware)
// -----------------------------------------------------------------------------
app.post('/webhook', express.raw({ type: 'application/json' }), (request, response) => {
  const sig = request.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      request.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`❌ Webhook Signature Verification Failed: ${err.message}`);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    console.log('\n💳 [Webhook] Payment Successful!');
    console.log(`Session ID: ${session.id}`);
    console.log(`Customer Email: ${session.customer_details.email}`);
    console.log(`User ID from Metadata: ${session.metadata.userId}`);
  }

  response.json({ received: true });
});

// -----------------------------------------------------------------------------
// 2. STANDARD JSON MIDDLEWARE (For all routes below the webhook)
// -----------------------------------------------------------------------------
app.use(express.json());

// -----------------------------------------------------------------------------
// 3. CREATE CHECKOUT SESSION ENDPOINT
// -----------------------------------------------------------------------------
app.post('/create-checkout-session', async (req, res) => {
  const { userId } = req.body;

  try {
   const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    // Pass the incoming userId from the frontend request body
    client_reference_id: userId, 
    metadata: {
        purpose: 'premium_upgrade'
    },
    line_items: [
        {
            price_data: {
                currency: 'usd',
                product_data: {
                    name: 'Premium Bank Account Upgrade',
                    description: 'Unlock exclusive dashboard features (Simulated Sandbox).',
                },
                unit_amount: 2500, // $25.00
            },
            quantity: 1,
        },
    ],
    mode: 'payment',
    success_url:  'https://bank-api-hdv2.onrender.com/?status=success',
    cancel_url:   'https://bank-api-hdv2.onrender.com/?status=cancel',
});

    res.json({ url: session.url });
  } catch (error) {
    console.error(`❌ Error creating checkout session: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Quick placeholder redirect routes for verification
app.get('/api/success', (req, res) => res.send('<h1>Payment Simulation Successful!</h1>'));
app.get('/api/cancel', (req, res) => res.send('<h1>Payment Canceled.</h1>'));

// -----------------------------------------------------------------------------
// 4. TROUBLESHOOTING CATCH-ALL LOGGER
// -----------------------------------------------------------------------------
// This catches any requests that missed our routes above and prints them to your console.
app.use((req, res) => {
  console.log(`📡 [LOG] Received an unhandled ${req.method} request to: ${req.url}`);
  res.status(404).json({
    error: "Route not found on this server instance",
    receivedMethod: req.method,
    receivedUrl: req.url
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
});
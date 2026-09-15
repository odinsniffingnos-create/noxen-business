const STRIPE_CONFIG = {
  mode: 'demo',
  publishableKey: 'pk_test_demo_replace_me',
  apiVersion: '2024-06-20',
  enabled: true,
  provider: 'stripe-ready',
};

const normalizePlanId = (planId = 'free') => {
  if (planId === 'pro' || planId === 'scale') return planId;
  return 'free';
};

export const getBillingProviderConfig = () => ({ ...STRIPE_CONFIG });

export const createCheckoutSession = async ({ planId, billingFrequency, customerEmail }) => {
  const provider = getBillingProviderConfig();
  const normalizedPlanId = normalizePlanId(planId);
  const sessionId = `demo_checkout_${normalizedPlanId}_${Date.now()}`;

  return {
    ok: true,
    mode: 'demo',
    message: `Demo checkout completed successfully. ${normalizedPlanId.toUpperCase()} access is active for ${customerEmail || 'this business'} immediately.`,
    checkoutUrl: null,
    provider: provider.provider,
    planId: normalizedPlanId,
    billingFrequency: billingFrequency || 'monthly',
    customerEmail,
    sessionId,
    status: 'paid',
  };
};

export const getBillingProviderWarning = () => 'Demo checkout is enabled for local product testing. Connect a real payment provider to process actual charges.';

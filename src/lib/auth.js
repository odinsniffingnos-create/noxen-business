const AUTH_STORAGE_KEY = 'noxen-auth-session';

const normalizePlan = (planId = 'free') => {
  if (planId === 'pro' || planId === 'scale') return planId;
  return 'free';
};

export const demoUsers = [
  {
    email: 'owner@noxenbusiness.com',
    password: 'noxen123',
    businessName: 'Noxen Business',
    role: 'owner',
    plan: 'pro',
    features: ['dashboard', 'customers', 'appointments', 'invoices', 'tasks', 'marketing', 'advanced_analytics'],
  },
  {
    email: 'team@noxenbusiness.com',
    password: 'noxen456',
    businessName: 'Noxen Growth',
    role: 'manager',
    plan: 'free',
    features: ['dashboard', 'customers', 'appointments', 'invoices', 'tasks'],
  },
];

export const getAuthSession = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const signIn = ({ email, password, businessName, plan }) => {
  const user = demoUsers.find(
    (candidate) => candidate.email.toLowerCase() === String(email).toLowerCase() && candidate.password === String(password)
  );

  if (!user) {
    return null;
  }

  const session = {
    user: {
      email: user.email,
      businessName: businessName || user.businessName,
      role: user.role,
      plan: normalizePlan(plan || user.plan),
    },
    token: `demo-token-${user.email}-${Date.now()}`,
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  }

  return session;
};

export const updateSessionPlan = (planId) => {
  if (typeof window === 'undefined') return null;

  const session = getAuthSession();
  if (!session?.user) return null;

  const nextSession = {
    ...session,
    user: {
      ...session.user,
      plan: normalizePlan(planId),
    },
  };

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
  return nextSession;
};

export const signOut = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  return true;
};

export const hasFeatureAccess = (session, featureName) => {
  if (!session?.user) return false;

  const planFeatures = {
    free: ['dashboard', 'customers', 'appointments', 'invoices', 'tasks'],
    pro: ['dashboard', 'customers', 'appointments', 'invoices', 'tasks', 'marketing', 'advanced_analytics'],
    scale: ['dashboard', 'customers', 'appointments', 'invoices', 'tasks', 'marketing', 'advanced_analytics', 'team_collaboration', 'automation'],
  };

  const plan = normalizePlan(session.user.plan || 'free');
  return (planFeatures[plan] || []).includes(featureName);
};

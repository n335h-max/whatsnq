const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, 'users.json');
const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['trialing', 'active']);
const OWNER_ADMIN_EMAIL = 'n33sh07@gmail.com';

const PLAN_DEFINITIONS = {
  business: {
    id: 'business',
    name: 'Business',
    priceMonthly: 50,
    currency: 'MYR',
    botLimit: 1,
    teamSeats: 1,
    analytics: 'Core analytics',
    support: 'Standard support'
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    priceMonthly: null,
    currency: 'MYR',
    botLimit: null,
    teamSeats: null,
    analytics: 'Advanced analytics',
    support: 'Priority support'
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function generateUserId() {
  return 'usr_' + Math.random().toString(36).slice(2, 11);
}

function getPlanDefinition(planId = 'business') {
  return PLAN_DEFINITIONS[planId] || PLAN_DEFINITIONS.business;
}

function isOwnerAdminEmail(email = '') {
  return email.toLowerCase().trim() === OWNER_ADMIN_EMAIL;
}

function resolvePlan(user) {
  const basePlan = clone(getPlanDefinition(user.planId));
  if (isOwnerAdminEmail(user.email)) {
    return {
      ...basePlan,
      id: 'owner',
      name: 'Owner',
      botLimit: null,
      teamSeats: null,
      analytics: 'Unlimited analytics',
      support: 'Owner admin access'
    };
  }
  if (user.planId === 'custom' && user.customPlan && typeof user.customPlan === 'object') {
    return { ...basePlan, ...clone(user.customPlan) };
  }
  return basePlan;
}

function normalizeUser(user) {
  const now = Date.now();
  const trialStartDate = user.trialStartDate || now;
  const clientIds = Array.isArray(user.clientIds)
    ? Array.from(new Set(user.clientIds.map((value) => String(value).trim()).filter(Boolean)))
    : [];
  const normalized = {
    userId: user.userId || generateUserId(),
    email: (user.email || '').toLowerCase().trim(),
    password: user.password || null,
    provider: user.provider || 'email',
    clientIds,
    trialStartDate,
    trialEndDate: user.trialEndDate || (trialStartDate + TRIAL_DURATION_MS),
    isPaid: Boolean(user.isPaid),
    planId: user.planId || 'business',
    customPlan: user.customPlan || null,
    billingProvider: user.billingProvider || null,
    stripeCustomerId: user.stripeCustomerId || null,
    stripeSubscriptionId: user.stripeSubscriptionId || null,
    stripePriceId: user.stripePriceId || null,
    subscriptionStatus: user.subscriptionStatus || 'inactive',
    subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd || null
  };

  return normalized;
}

function buildSafeUser(user) {
  const normalized = normalizeUser(user);
  const now = Date.now();
  const isOwnerAdmin = isOwnerAdminEmail(normalized.email);
  const trialExpired = isOwnerAdmin ? false : now > normalized.trialEndDate;
  const trialTimeRemainingMs = isOwnerAdmin ? 0 : Math.max(0, normalized.trialEndDate - now);
  const hasSubscriptionAccess = ACTIVE_SUBSCRIPTION_STATUSES.has(normalized.subscriptionStatus);
  const hasAccess = isOwnerAdmin || normalized.isPaid || hasSubscriptionAccess || !trialExpired;

  return {
    userId: normalized.userId,
    email: normalized.email,
    isOwnerAdmin,
    provider: normalized.provider,
    planId: normalized.planId,
    plan: resolvePlan(normalized),
    isPaid: normalized.isPaid,
    billingProvider: normalized.billingProvider,
    stripeCustomerId: normalized.stripeCustomerId,
    stripeSubscriptionId: normalized.stripeSubscriptionId,
    stripePriceId: normalized.stripePriceId,
    subscriptionStatus: normalized.subscriptionStatus,
    subscriptionCurrentPeriodEnd: normalized.subscriptionCurrentPeriodEnd,
    hasSubscriptionAccess,
    hasAccess,
    trialExpired,
    trialTimeRemainingMs,
    trialStartDate: normalized.trialStartDate,
    trialEndDate: normalized.trialEndDate,
    clientIds: normalized.clientIds
  };
}

function addClientToUser(userId, clientId) {
  if (!userId || !clientId) throw new Error('userId and clientId are required.');
  const users = loadUsers();
  const user = users[userId];
  if (!user) throw new Error('User not found.');
  const normalizedClientId = String(clientId).trim();
  if (!normalizedClientId) throw new Error('Invalid clientId.');
  const next = normalizeUser({
    ...user,
    clientIds: Array.from(new Set([...(user.clientIds || []), normalizedClientId]))
  });
  users[userId] = next;
  saveUsers(users);
  return buildSafeUser(next);
}

function removeClientFromAllUsers(clientId) {
  if (!clientId) return;
  const normalizedClientId = String(clientId).trim();
  const users = loadUsers();
  let mutated = false;
  Object.keys(users).forEach((userId) => {
    const user = users[userId];
    const existing = Array.isArray(user.clientIds) ? user.clientIds : [];
    if (existing.includes(normalizedClientId)) {
      users[userId] = normalizeUser({
        ...user,
        clientIds: existing.filter((value) => value !== normalizedClientId)
      });
      mutated = true;
    }
  });
  if (mutated) saveUsers(users);
}

function loadUsers() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: {} }, null, 2), 'utf8');
    return {};
  }

  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const sourceUsers = parsed.users || {};
    const normalizedUsers = {};
    let mutated = false;

    Object.entries(sourceUsers).forEach(([userId, user]) => {
      const normalized = normalizeUser({ ...user, userId });
      normalizedUsers[userId] = normalized;
      if (JSON.stringify(user) !== JSON.stringify(normalized)) {
        mutated = true;
      }
    });

    if (mutated) {
      saveUsers(normalizedUsers);
    }

    return normalizedUsers;
  } catch (err) {
    console.error('[User Manager] Failed to load users.json:', err.message);
    return {};
  }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users }, null, 2), 'utf8');
  } catch (err) {
    console.error('[User Manager] Failed to save users.json:', err.message);
  }
}

function findUserByEmail(users, email) {
  const normalizedEmail = email.toLowerCase().trim();
  return Object.values(users).find((user) => user.email === normalizedEmail);
}

function findUserId(users, lookup = {}) {
  if (lookup.userId && users[lookup.userId]) return lookup.userId;

  return Object.keys(users).find((userId) => {
    const user = users[userId];
    if (lookup.email && user.email === lookup.email.toLowerCase().trim()) return true;
    if (lookup.customerId && user.stripeCustomerId === lookup.customerId) return true;
    if (lookup.subscriptionId && user.stripeSubscriptionId === lookup.subscriptionId) return true;
    return false;
  }) || null;
}

function signUp(email, password, provider = 'email') {
  if (!email) throw new Error('Email is required.');

  const users = loadUsers();
  const normalizedEmail = email.toLowerCase().trim();
  const existing = findUserByEmail(users, normalizedEmail);

  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const now = Date.now();
  const userId = generateUserId();
  users[userId] = normalizeUser({
    userId,
    email: normalizedEmail,
    password: password || null,
    provider,
    trialStartDate: now,
    trialEndDate: now + TRIAL_DURATION_MS,
    planId: 'business'
  });

  saveUsers(users);
  return buildSafeUser(users[userId]);
}

function login(email, password) {
  if (!email || !password) throw new Error('Email and password are required.');

  const users = loadUsers();
  const normalizedEmail = email.toLowerCase().trim();
  const user = findUserByEmail(users, normalizedEmail);

  if (!user || user.provider !== 'email' || user.password !== password) {
    throw new Error('Invalid email or password.');
  }

  return buildSafeUser(user);
}

function oauthLogin(email, provider) {
  if (!email || !provider) throw new Error('Email and provider are required.');

  const users = loadUsers();
  const normalizedEmail = email.toLowerCase().trim();
  let user = findUserByEmail(users, normalizedEmail);

  if (!user) {
    const now = Date.now();
    const userId = generateUserId();
    users[userId] = normalizeUser({
      userId,
      email: normalizedEmail,
      password: null,
      provider,
      trialStartDate: now,
      trialEndDate: now + TRIAL_DURATION_MS,
      planId: 'business'
    });
    saveUsers(users);
    user = users[userId];
  }

  return buildSafeUser(user);
}

function getUserStatus(userId) {
  const users = loadUsers();
  const user = users[userId];

  if (!user) {
    throw new Error('User not found.');
  }

  return buildSafeUser(user);
}

function markPaid(userId, planId = 'business') {
  const users = loadUsers();
  const user = users[userId];

  if (!user) {
    throw new Error('User not found.');
  }

  user.isPaid = true;
  user.planId = planId;
  user.subscriptionStatus = 'active';
  user.billingProvider = user.billingProvider || 'manual';
  saveUsers(users);

  return buildSafeUser(user);
}

function upsertStripeBilling(lookup, updates = {}) {
  const users = loadUsers();
  const userId = findUserId(users, lookup);

  if (!userId) {
    throw new Error('User not found.');
  }

  const user = users[userId];

  if (updates.customerId) user.stripeCustomerId = updates.customerId;
  if (updates.subscriptionId) user.stripeSubscriptionId = updates.subscriptionId;
  if (updates.priceId) user.stripePriceId = updates.priceId;
  if (updates.subscriptionStatus) user.subscriptionStatus = updates.subscriptionStatus;
  if (updates.currentPeriodEnd !== undefined) {
    user.subscriptionCurrentPeriodEnd = updates.currentPeriodEnd;
  }
  if (updates.planId) {
    user.planId = updates.planId;
  }

  user.billingProvider = 'stripe';

  if (updates.subscriptionStatus === 'active') {
    user.isPaid = true;
  }
  if (updates.subscriptionStatus && !ACTIVE_SUBSCRIPTION_STATUSES.has(updates.subscriptionStatus)) {
    user.isPaid = false;
  }

  saveUsers(users);
  return buildSafeUser(user);
}

module.exports = {
  PLAN_DEFINITIONS,
  signUp,
  login,
  oauthLogin,
  getPlanDefinition,
  getUserStatus,
  markPaid,
  upsertStripeBilling,
  addClientToUser,
  removeClientFromAllUsers
};

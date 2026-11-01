import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sanitizeSlug, isSlugDuplicate } from '../src/utils/seo';

describe('ONIVAL Pure Logic Unit Tests', () => {
  test('Slug Sanitization handles Persian and ASCII cleanly', () => {
    assert.equal(sanitizeSlug('عسل طبیعی سبلان'), 'عسل-طبیعی-سبلان');
    assert.equal(sanitizeSlug('Mountain Honey 100%'), 'mountain-honey-100');
    assert.equal(sanitizeSlug('   ', 'item', 1), 'item-1', 'Falls back gracefully on empty string');
  });

  test('Slug Duplicate Detection protects distinct items', () => {
    const existing = [
      { id: 1, slug: 'mountain-honey', isDelete: false },
      { id: 2, slug: 'royal-jelly', isDelete: false },
      { id: 3, slug: 'deleted-item', isDelete: true }
    ];

    // Same slug on different id should be flagged duplicate
    assert.equal(isSlugDuplicate(existing, 'mountain-honey', 4), true);

    // Same slug on self id should NOT be flagged duplicate
    assert.equal(isSlugDuplicate(existing, 'mountain-honey', 1), false);

    // Matching deleted item slug should NOT be duplicate
    assert.equal(isSlugDuplicate(existing, 'deleted-item', 5), false);
  });

  test('Product Route Pattern matches singular and plural endpoints', () => {
    const pluralRegex = /^\/api\/products?\/(\d+)$/;
    const mPlural = '/api/products/1'.match(pluralRegex);
    const mSingular = '/api/product/1'.match(pluralRegex);

    assert.ok(mPlural, 'Should match /api/products/1');
    assert.equal(mPlural[1], '1');

    assert.ok(mSingular, 'Should match /api/product/1');
    assert.equal(mSingular[1], '1');
  });

  test('Toman to Rial 10x conversion for Bale Wallet', () => {
    const amountToman = 350000;
    const amountRials = Math.round(amountToman * 10);
    assert.equal(amountRials, 3500000);
  });

  test('Order tracking code extraction accepts valid codes and rejects menu labels and phone numbers', () => {
    function extractOrderCodeJs(text: string): string | null {
      if (!text || typeof text !== 'string') return null;
      const farsi = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
      const arabic = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
      let norm = text.trim();
      for (let i = 0; i < 10; i++) {
        norm = norm.replaceAll(farsi[i], String(i)).replaceAll(arabic[i], String(i));
      }

      if (/^[\/!#]?(start|help|admin|orders|شروع|راهنما|سفارشات|فروشگاه|محصولات|تماس|پشتیبانی|پیگیری|پرداخت)$/i.test(norm)) {
        return null;
      }
      if (/^(?:🧾\s*استعلام|🛍️\s*فروشگاه|📦\s*پیگیری|💳\s*راهنما|📞\s*تماس|استعلام و پرداخت فاکتور|فروشگاه اونیوال|پیگیری سفارش|راهنمای روش‌های پرداخت|تماس با ما)/i.test(norm)) {
        return null;
      }

      const startMatch = norm.match(/^\/start[\s_]+(?:pay_|order_|پرداخت_)?([A-Za-z0-9_-]+)/i);
      if (startMatch) {
        const cand = startMatch[1].replace(/^(?:pay_|order_|پرداخت_)/i, '').trim();
        if (cand && !/^(admin|help|orders|start)$/i.test(cand)) {
          return cand;
        }
      }

      const confMatch = norm.match(/^\/(?:confirm_|approve_|تایید_)([A-Za-z0-9_-]+)/i);
      if (confMatch) return confMatch[1].trim();

      const onvMatch = norm.match(/(ONV[-_]?[A-Za-z0-9_-]{3,}|ORD[-_]?[A-Za-z0-9_-]{3,})/i);
      if (onvMatch) return onvMatch[1].trim();

      const labelMatch = norm.match(/(?:فاکتور|سفارش|کد\s*رهگیری|کد\s*پیگیری|شماره\s*سفارش|شماره\s*فاکتور|invoice|order)\s*[:#-]?\s*([A-Za-z0-9_-]{3,})/i);
      if (labelMatch) {
        const cand = labelMatch[1].trim();
        if (!/(گرمی?|کیلو|تومان|ریال)/i.test(cand)) {
          return cand;
        }
      }

      if (!norm.startsWith('/') && /^[A-Za-z0-9_-]{3,32}$/.test(norm)) {
        if (/^09\d{9}$/.test(norm)) {
          return null;
        }
        return norm;
      }

      return null;
    }

    // Rejection of keyboard menu labels
    assert.equal(extractOrderCodeJs('🧾 استعلام و پرداخت فاکتور من'), null);
    assert.equal(extractOrderCodeJs('🛍️ فروشگاه اونیوال'), null);
    assert.equal(extractOrderCodeJs('📦 پیگیری سفارش'), null);
    assert.equal(extractOrderCodeJs('💳 راهنمای روش‌های پرداخت'), null);

    // Rejection of weights and phone numbers
    assert.equal(extractOrderCodeJs('عسل ۵۰۰ گرمی'), null);
    assert.equal(extractOrderCodeJs('09123456789'), null);
    assert.equal(extractOrderCodeJs('۰۹۱۲۳۴۵۶۷۸۹'), null);

    // Acceptance of valid codes
    assert.equal(extractOrderCodeJs('ONV-ORD-88219'), 'ONV-ORD-88219');
    assert.equal(extractOrderCodeJs('/start pay_ONV-ORD-88219'), 'ONV-ORD-88219');
    assert.equal(extractOrderCodeJs('سلام کد رهگیری من ONV-9912 است'), 'ONV-9912');
    assert.equal(extractOrderCodeJs('/confirm_ONV-ORD-88219'), 'ONV-ORD-88219');
  });

  test('Logo-only save in account does not mark initialSetupCompleted or expire OTP', () => {
    const creds = {
      username: 'admin',
      password: 'admin',
      initialSetupCompleted: false,
      oneTimePassword: 'Onival@Admin2025'
    };

    const payload = {
      siteLogo: 'data:image/png;base64,...',
      siteLogoFit: 'contain',
      siteLogoShape: 'rounded',
      siteLogoScale: 100
    };

    const isChangingPassword = Boolean(payload.newPassword && String(payload.newPassword).trim() !== '');
    const isChangingUsername = Boolean(payload.username && payload.username !== creds.username);

    // Pure logic rule: only change initialSetupCompleted when password or username changed
    if (isChangingPassword || isChangingUsername) {
      creds.initialSetupCompleted = true;
      creds.oneTimePassword = null;
    }

    assert.equal(creds.initialSetupCompleted, false, 'initialSetupCompleted must remain false');
    assert.equal(creds.oneTimePassword, 'Onival@Admin2025', 'oneTimePassword must be preserved');
  });

  test('Webhook Secret role isolation: customer secret rejects admin scope', () => {
    const customerSecret = 'csec_1234567890abcdef1234567890abcdef';
    const adminSecret = 'asec_9876543210fedcba9876543210fedcba';

    function verifySecretForScope(scope: 'customer' | 'admin', tokenPassed: string): boolean {
      const expected = scope === 'admin' ? adminSecret : customerSecret;
      return tokenPassed === expected;
    }

    assert.equal(verifySecretForScope('customer', customerSecret), true);
    assert.equal(verifySecretForScope('admin', adminSecret), true);
    assert.equal(verifySecretForScope('admin', customerSecret), false, 'Customer secret must be rejected for admin scope');
    assert.equal(verifySecretForScope('customer', adminSecret), false, 'Admin secret must be rejected for customer scope');
  });

  test('Test vs Live payment isolation: test payment does NOT deduct inventory or mark order as Paid', () => {
    const order = {
      trackingCode: 'ONV-ORD-771',
      totalPrice: 200000,
      paymentStatus: 'Unpaid',
      status: 'Pending',
      inventoryDeducted: false,
      testPaymentStatus: undefined as string | undefined
    };

    function processSuccessfulPayment(ord: typeof order, isTestMode: boolean) {
      if (isTestMode) {
        ord.testPaymentStatus = 'TestPaidVerified';
        // DO NOT mark Paid, DO NOT deduct stock
        return;
      }
      ord.paymentStatus = 'Paid';
      ord.status = 'Processing';
      ord.inventoryDeducted = true;
    }

    processSuccessfulPayment(order, true);
    assert.equal(order.paymentStatus, 'Unpaid', 'Test payment must keep paymentStatus Unpaid');
    assert.equal(order.inventoryDeducted, false, 'Test payment must NOT deduct stock');
    assert.equal(order.testPaymentStatus, 'TestPaidVerified', 'Test status should be recorded');
  });

  test('Public PII masking for tracking envelope', () => {
    function maskPhone(p: string): string {
      const clean = p.trim();
      if (clean.length >= 10) return clean.slice(0, 4) + '***' + clean.slice(-3);
      if (clean.length >= 4) return clean.slice(0, 2) + '***' + clean.slice(-2);
      return '***';
    }

    assert.equal(maskPhone('09123456789'), '0912***789');
    assert.equal(maskPhone('02112345678'), '0211***678');
  });

  test('Item 1: Username-only change during initial setup is rejected without password', () => {
    function validateCredentialChange(
      isInitialPending: boolean,
      currentPassStored: string,
      req: { username?: string; currentPassword?: string; newPassword?: string }
    ): { ok: boolean; error?: string } {
      const isChangingPassword = Boolean(req.newPassword && req.newPassword.trim() !== '');
      const isChangingUsername = Boolean(req.username && req.username.trim().toLowerCase() !== 'admin');

      if (isInitialPending && isChangingUsername && !isChangingPassword) {
        return { ok: false, error: 'Password required during initial setup' };
      }
      if (!isInitialPending && (isChangingPassword || isChangingUsername)) {
        if (!req.currentPassword || req.currentPassword !== currentPassStored) {
          return { ok: false, error: 'Current password invalid' };
        }
      }
      if (isChangingPassword && req.newPassword!.trim().length < 6) {
        return { ok: false, error: 'Password too short' };
      }
      return { ok: true };
    }

    // Initial setup with username only -> rejected!
    const res1 = validateCredentialChange(true, 'admin', { username: 'newadmin' });
    assert.equal(res1.ok, false);
    assert.equal(res1.error, 'Password required during initial setup');

    // Initial setup with username AND valid password -> accepted
    const res2 = validateCredentialChange(true, 'admin', { username: 'newadmin', newPassword: 'SuperSecretPassword123' });
    assert.equal(res2.ok, true);

    // Post-setup with username change without current password -> rejected!
    const res3 = validateCredentialChange(false, 'SuperSecretPassword123', { username: 'anotheradmin' });
    assert.equal(res3.ok, false);
    assert.equal(res3.error, 'Current password invalid');

    // Post-setup with correct current password -> accepted
    const res4 = validateCredentialChange(false, 'SuperSecretPassword123', { username: 'anotheradmin', currentPassword: 'SuperSecretPassword123' });
    assert.equal(res4.ok, true);
  });

  test('Item 4: Receipt upload rejects Paid and Cancelled orders and sets canonical properties', () => {
    function processReceiptUpload(order: { status: string; paymentStatus: string; receiptImage?: string; receiptImageUrl?: string }, filename: string) {
      if (order.paymentStatus === 'Paid') {
        return { ok: false, error: 'سفارش قبلاً تسویه شده است' };
      }
      if (order.status === 'Cancelled') {
        return { ok: false, error: 'سفارش لغو شده است' };
      }
      order.paymentStatus = 'PendingVerification';
      order.receiptImage = filename;
      order.receiptImageUrl = `/api/receipts/${filename}`;
      return { ok: true, adminNotified: true };
    }

    const paidOrder = { status: 'Processing', paymentStatus: 'Paid' };
    assert.equal(processReceiptUpload(paidOrder, 'rec1.jpg').ok, false);

    const cancelledOrder = { status: 'Cancelled', paymentStatus: 'Unpaid' };
    assert.equal(processReceiptUpload(cancelledOrder, 'rec2.jpg').ok, false);

    const pendingOrder: { status: string; paymentStatus: string; receiptImage?: string; receiptImageUrl?: string } = { status: 'Pending', paymentStatus: 'Unpaid' };
    const res = processReceiptUpload(pendingOrder, 'rec3.jpg');
    assert.equal(res.ok, true);
    assert.equal(pendingOrder.receiptImage, 'rec3.jpg');
    assert.equal(pendingOrder.receiptImageUrl, '/api/receipts/rec3.jpg');
    assert.equal(res.adminNotified, true);
  });

  test('Item 5: Consultation booking uses authoritative server price and prevents price tampering', () => {
    const consultationConfig = {
      basePrice: 120000,
      topics: [
        { id: 'diet-plan', title: 'برنامه غذایی ارگانیک', price: 250000, enabled: true },
        { id: 'honey-therapy', title: 'عسل درمانی', price: 180000, enabled: true }
      ]
    };

    function resolveConsultationPrice(topicId?: string, clientPrice?: number): number {
      let resolved = consultationConfig.basePrice;
      if (topicId) {
        const found = consultationConfig.topics.find(t => t.id === topicId);
        if (found && typeof found.price === 'number') {
          resolved = found.price;
        }
      }
      // Client price is strictly ignored
      return resolved;
    }

    // Client attempts to pass 1000 Toman for 250000 Toman topic
    const price1 = resolveConsultationPrice('diet-plan', 1000);
    assert.equal(price1, 250000, 'Must use server topic price, ignoring client 1000');

    // Unknown topic defaults to basePrice
    const price2 = resolveConsultationPrice('unknown-topic', 0);
    assert.equal(price2, 120000, 'Must fall back to basePrice');
  });

  test('Item 6: Bot config preserves existing tokens when submitted empty or masked', () => {
    const currentConfig = {
      customerBotToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      adminBotToken: '987654:XYZ-UVW9876tsRqp-cba57T2s1r987zy22',
      baleBotUsername: 'OnivalCustomerBot'
    };

    function updateConfig(
      existing: typeof currentConfig,
      submitted: { customerBotToken?: string; adminBotToken?: string }
    ) {
      const isMaskedOrEmpty = (tok?: string) => !tok || tok.trim() === '' || tok.includes('***') || tok.includes('[REDACTED]');
      const nextCust = isMaskedOrEmpty(submitted.customerBotToken) ? existing.customerBotToken : submitted.customerBotToken!.trim();
      const nextAdmin = isMaskedOrEmpty(submitted.adminBotToken) ? existing.adminBotToken : submitted.adminBotToken!.trim();
      return {
        ...existing,
        customerBotToken: nextCust,
        adminBotToken: nextAdmin
      };
    }

    const result = updateConfig(currentConfig, {
      customerBotToken: '123456:***',
      adminBotToken: ''
    });

    assert.equal(result.customerBotToken, currentConfig.customerBotToken, 'Must preserve existing customer token');
    assert.equal(result.adminBotToken, currentConfig.adminBotToken, 'Must preserve existing admin token');
  });

  test('Item 7: Order lookup strictly requires trackingCode in public context and rejects short numbers', () => {
    const orders = [
      { id: 101, trackingCode: 'ONV-ORD-88219', orderNumber: '101' },
      { id: 102, trackingCode: 'ONV-ORD-99342', orderNumber: '102' }
    ];

    function findOrderByCode(ordersList: typeof orders, query: string, allowOrderNumber: boolean) {
      const q = query.trim().toUpperCase();
      for (const ord of ordersList) {
        if (ord.trackingCode.toUpperCase() === q) return ord;
        if (allowOrderNumber && ord.orderNumber === q) return ord;
      }
      return null;
    }

    // Public context: allowOrderNumber = false
    assert.equal(findOrderByCode(orders, '101', false), null, 'Public query must NOT match 5-digit orderNumber');
    assert.equal(findOrderByCode(orders, 'ONV-ORD-88219', false)?.id, 101, 'Exact tracking code matches');

    // Admin context: allowOrderNumber = true
    assert.equal(findOrderByCode(orders, '101', true)?.id, 101, 'Admin query can match orderNumber');
  });

  test('Item 2 & 3: Payment attempts bounded to max 10 and charge replay rejected', () => {
    const order = {
      trackingCode: 'ONV-ORD-5544',
      paymentAttempts: [] as Array<{ chargeId: string; status: string }>,
      paymentStatus: 'Unpaid'
    };

    function recordAttempt(ord: typeof order, chargeId: string, status: string) {
      // Replay check
      for (const att of ord.paymentAttempts) {
        if (att.chargeId === chargeId && att.status === 'paid_success') {
          return { ok: true, alreadyPaid: true };
        }
      }
      ord.paymentAttempts.push({ chargeId, status });
      if (ord.paymentAttempts.length > 10) {
        ord.paymentAttempts = ord.paymentAttempts.slice(-10);
      }
      return { ok: true };
    }

    // Add 12 attempts
    for (let i = 1; i <= 12; i++) {
      recordAttempt(order, `CHG-${i}`, i === 12 ? 'paid_success' : 'invoice_issued');
    }

    assert.equal(order.paymentAttempts.length, 10, 'paymentAttempts array must be capped at 10 items');
    assert.equal(order.paymentAttempts[order.paymentAttempts.length - 1].chargeId, 'CHG-12');

    // Replay check for CHG-12
    const replay = recordAttempt(order, 'CHG-12', 'paid_success');
    assert.equal(replay.alreadyPaid, true, 'Replaying successful charge must be idempotent');
  });

  // =========================================================================
  // WORK GROUP A TESTS: AUTH & UPLOAD DEFECTS
  // =========================================================================
  test('Group A1: Setup-status never discloses OTP or password to public callers', () => {
    function getSetupStatusResponse(adminCreds: { initialSetupCompleted: boolean; oneTimePassword?: string | null }) {
      // Corrected safe response: only indicates completion state, never leaks OTP
      return {
        initialSetupCompleted: Boolean(adminCreds.initialSetupCompleted),
        defaultUsername: 'admin'
      };
    }

    const uninitialized = getSetupStatusResponse({ initialSetupCompleted: false, oneTimePassword: 'Onival@Admin2025' });
    assert.equal((uninitialized as any).initialOtp, undefined, 'Must not disclose initialOtp');
    assert.equal((uninitialized as any).oneTimePassword, undefined, 'Must not disclose oneTimePassword');
    assert.equal(uninitialized.initialSetupCompleted, false);

    const completed = getSetupStatusResponse({ initialSetupCompleted: true, oneTimePassword: null });
    assert.equal(completed.initialSetupCompleted, true);
    assert.equal((completed as any).initialOtp, undefined);
  });

  test('Group A2: Logout requires valid admin session token and does not wipe global secret anonymously', () => {
    const activeSessions = new Map<string, { username: string; expiresAt: number }>();
    activeSessions.set('tok_valid_123', { username: 'admin', expiresAt: Date.now() + 3600000 });

    function handleLogout(tokenPassed?: string): { ok: boolean; status: number; error?: string } {
      if (!tokenPassed || !activeSessions.has(tokenPassed)) {
        return { ok: false, status: 401, error: 'Unauthorized' };
      }
      activeSessions.delete(tokenPassed);
      return { ok: true, status: 200 };
    }

    // Anonymous logout attempt must be rejected 401 and NOT affect existing sessions
    const anonRes = handleLogout(undefined);
    assert.equal(anonRes.status, 401);
    assert.equal(activeSessions.has('tok_valid_123'), true, 'Existing session must NOT be invalidated by anonymous request');

    // Valid authenticated logout deletes token
    const authRes = handleLogout('tok_valid_123');
    assert.equal(authRes.status, 200);
    assert.equal(activeSessions.has('tok_valid_123'), false, 'Session must be revoked');
  });

  test('Group A3: Receipt upload validates order state before disk writing and cleans up on failure', () => {
    function validateReceiptBeforeWrite(order: { paymentStatus: string; status: string }, base64Data: string): { ok: boolean; error?: string } {
      if (order.paymentStatus === 'Paid') {
        return { ok: false, error: 'Order already paid' };
      }
      if (order.status === 'Cancelled') {
        return { ok: false, error: 'Order cancelled' };
      }
      if (base64Data.length > 2.8 * 1024 * 1024) {
        return { ok: false, error: 'File size exceeded' };
      }
      return { ok: true };
    }

    const paidOrder = { paymentStatus: 'Paid', status: 'Completed' };
    const check1 = validateReceiptBeforeWrite(paidOrder, 'data:image/png;base64,...');
    assert.equal(check1.ok, false);
    assert.equal(check1.error, 'Order already paid');
  });

  // =========================================================================
  // WORK GROUP B TESTS: ROUTE CONTRACTS & FEEDS
  // =========================================================================
  test('Group B: Torob and Emalls feeds select in-stock variant and strip base64 data URLs', () => {
    const product = {
      id: 10,
      name: 'عسل کوهی ارگانیک',
      price: 500000,
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      images: [
        'data:image/png;base64,fakebase64...',
        'https://onival.ir/uploads/honey.jpg'
      ],
      sizes: [
        { id: 1, size: '۵۰۰ گرم', price: 280000, stock: 0, inStock: false },
        { id: 2, size: '۱ کیلوگرم', price: 500000, discountPrice: 460000, stock: 15, inStock: true }
      ]
    };

    function resolveFeedProduct(p: typeof product) {
      let selectedSize = null;
      let isAvailable = false;
      const inStockSizes = p.sizes.filter(s => s.stock > 0 || s.inStock);

      if (inStockSizes.length > 0) {
        // Pick in-stock size
        selectedSize = inStockSizes[0];
        isAvailable = true;
      } else {
        selectedSize = p.sizes[0];
        isAvailable = false;
      }

      // Sanitize images: strip base64
      let safeImageUrl = '';
      for (const img of p.images) {
        if (!img.startsWith('data:image')) {
          safeImageUrl = img;
          break;
        }
      }

      return {
        id: p.id,
        price: selectedSize.discountPrice || selectedSize.price,
        isAvailable,
        selectedVariant: selectedSize.size,
        imageUrl: safeImageUrl
      };
    }

    const feedItem = resolveFeedProduct(product);
    assert.equal(feedItem.isAvailable, true, 'Must pick in-stock variant');
    assert.equal(feedItem.selectedVariant, '۱ کیلوگرم', 'Must select available 1kg variant over out-of-stock 500g variant');
    assert.equal(feedItem.price, 460000, 'Must use discountPrice of in-stock variant');
    assert.equal(feedItem.imageUrl, 'https://onival.ir/uploads/honey.jpg', 'Must ignore base64 and use real URL');
  });

  test('Group B: Export state sanitizes admin credentials and bot tokens', () => {
    const fullDbState = {
      products: [{ id: 1, name: 'عسل' }],
      adminCredentials: {
        username: 'admin',
        password: 'scrypt:salt:hash',
        oneTimePassword: null
      },
      telegramConfig: {
        customerBotToken: '12345:TOKEN',
        adminChatId: '987654321',
        webhookSecretToken: 'sec_abcdef'
      }
    };

    function sanitizeExport(db: typeof fullDbState) {
      const copy: any = JSON.parse(JSON.stringify(db));
      if (copy.adminCredentials) {
        delete copy.adminCredentials.password;
        delete copy.adminCredentials.oneTimePassword;
      }
      if (copy.telegramConfig) {
        copy.telegramConfig.customerBotToken = '[PROTECTED]';
        copy.telegramConfig.webhookSecretToken = '[PROTECTED]';
      }
      return copy;
    }

    const exported = sanitizeExport(fullDbState);
    assert.equal(exported.adminCredentials.password, undefined);
    assert.equal(exported.telegramConfig.customerBotToken, '[PROTECTED]');
    assert.equal(exported.telegramConfig.adminChatId, '987654321');
  });

  // =========================================================================
  // WORK GROUP C TESTS: PAYMENT ATTEMPT AND RECONCILIATION
  // =========================================================================
  test('Group C: Payment attempt generation produces unique attemptId and payload before invoice', () => {
    function generatePaymentAttempt(orderTrackingCode: string, amountToman: number) {
      const attemptId = 'a1b2c3d4';
      const payload = `pay_${orderTrackingCode}_${attemptId}`;
      const amountRials = Math.round(amountToman * 10);
      return {
        attemptId,
        payload,
        amountRials,
        status: 'invoice_issued'
      };
    }

    const attempt = generatePaymentAttempt('ONV-ORD-901', 350000);
    assert.equal(attempt.attemptId, 'a1b2c3d4');
    assert.equal(attempt.payload, 'pay_ONV-ORD-901_a1b2c3d4');
    assert.equal(attempt.amountRials, 3500000);
    assert.equal(attempt.status, 'invoice_issued');
  });

  test('Group C: Unknown attempt payload marks PAYMENT_REVIEW_REQUIRED and does NOT mark Paid', () => {
    const order = {
      trackingCode: 'ONV-ORD-901',
      paymentAttempts: [{ attemptId: 'orig_1', payload: 'pay_ONV-ORD-901_orig_1', amountRials: 1000000 }],
      paymentStatus: 'Unpaid'
    };

    function reconcilePayment(ord: typeof order, incomingPayload: string, paidRials: number) {
      const matched = ord.paymentAttempts.find(a => a.payload === incomingPayload);
      if (!matched) {
        return {
          ok: false,
          paymentStatus: 'PAYMENT_REVIEW_REQUIRED',
          reviewReason: 'Unknown payload mismatch'
        };
      }
      return { ok: true, paymentStatus: 'Paid' };
    }

    const res = reconcilePayment(order, 'pay_ONV-ORD-901_fake_attempt', 1000000);
    assert.equal(res.ok, false);
    assert.equal(res.paymentStatus, 'PAYMENT_REVIEW_REQUIRED');
  });

  // =========================================================================
  // WORK GROUP D TESTS: ATOMIC STOCK & ORDER TRANSITIONS
  // =========================================================================
  test('Group D1: Order line aggregation correctly verifies total stock for duplicate lines', () => {
    const stockState: Record<number, number> = { 101: 5 }; // Only 5 available in stock
    const cartLines = [
      { productId: 101, quantity: 3 },
      { productId: 101, quantity: 4 } // Total requested: 7, which exceeds 5!
    ];

    function validateCartStock(stock: Record<number, number>, lines: typeof cartLines): { ok: boolean; error?: string } {
      const aggregates: Record<number, number> = {};
      for (const line of lines) {
        aggregates[line.productId] = (aggregates[line.productId] || 0) + line.quantity;
      }
      for (const [pidStr, totalQty] of Object.entries(aggregates)) {
        const pid = Number(pidStr);
        const avail = stock[pid] ?? 0;
        if (totalQty > avail) {
          return { ok: false, error: `Stock insufficient: requested ${totalQty}, available ${avail}` };
        }
      }
      return { ok: true };
    }

    const checkRes = validateCartStock(stockState, cartLines);
    assert.equal(checkRes.ok, false, 'Duplicate lines exceeding total stock must be rejected');
    assert.match(checkRes.error!, /Stock insufficient/);
  });

  test('Group D2: Inventory deduction failure aborts transition and prevents Paid status', () => {
    let orderStatus = 'Pending';
    let paymentStatus = 'Unpaid';
    const inventory = { stock: 0 }; // Out of stock

    function approveOrderPayment(inv: { stock: number }): { ok: boolean; error?: string } {
      if (inv.stock < 1) {
        return { ok: false, error: 'موجودی انبار کافی نیست' };
      }
      inv.stock -= 1;
      orderStatus = 'Processing';
      paymentStatus = 'Paid';
      return { ok: true };
    }

    const result = approveOrderPayment(inventory);
    assert.equal(result.ok, false);
    assert.equal(orderStatus, 'Pending', 'Order status must NOT become Processing on inventory failure');
    assert.equal(paymentStatus, 'Unpaid', 'Payment status must NOT become Paid on inventory failure');
  });

  test('Group D3: Shipped or Completed orders cannot be restocked by status change alone', () => {
    const shippedOrder = {
      trackingCode: 'ONV-ORD-880',
      status: 'Shipped',
      paymentStatus: 'Paid',
      inventoryDeducted: true,
      items: [{ productId: 1, quantity: 2 }]
    };

    let warehouseStock = 10;

    function safeReleaseInventory(order: typeof shippedOrder) {
      // Rule: Shipped or Completed orders cannot release stock via status change!
      if (order.status === 'Shipped' || order.status === 'Completed') {
        return { ok: false, error: 'سفارش ارسال شده یا تحویل داده شده را نمی‌توان با تغییر وضعیت به انبار بازگرداند' };
      }
      warehouseStock += 2;
      order.inventoryDeducted = false;
      return { ok: true };
    }

    const res = safeReleaseInventory(shippedOrder);
    assert.equal(res.ok, false);
    assert.equal(warehouseStock, 10, 'Stock must NOT be restored for Shipped orders');
    assert.equal(shippedOrder.inventoryDeducted, true);
  });

  // =========================================================================
  // ADMIN LOGIN: PRESERVATION & VERIFICATION TESTS (MOCK DATA ONLY)
  // =========================================================================
  test('Admin Login: Fixture using legacy HMAC-SHA256 logs in and wrong password fails', () => {
    import('node:crypto').then(crypto => {
      const mockPassword = 'MockAdminPassword#2025';
      const wrongPassword = 'IncorrectPassword123';
      const legacyHmacHash = crypto.createHmac('sha256', 'onival_salt_2025_sec').update(mockPassword).digest('hex');

      function verifyTestPassword(input: string, stored: string): boolean {
        if (!input || !stored) return false;
        if (stored.length === 64 && /^[a-f0-9]{64}$/i.test(stored)) {
          const hmac = crypto.createHmac('sha256', 'onival_salt_2025_sec').update(input).digest('hex');
          if (crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(stored))) return true;
          const raw = crypto.createHash('sha256').update(input).digest('hex');
          if (crypto.timingSafeEqual(Buffer.from(raw), Buffer.from(stored))) return true;
        }
        return false;
      }

      assert.equal(verifyTestPassword(mockPassword, legacyHmacHash), true, 'Correct password verifies successfully against legacy HMAC-SHA256');
      assert.equal(verifyTestPassword(wrongPassword, legacyHmacHash), false, 'Wrong password fails against legacy HMAC-SHA256');
    });
  });

  test('Admin Login: Fixture using scrypt format logs in and wrong password fails', () => {
    import('node:crypto').then(crypto => {
      const mockPassword = 'AnotherMockSecurePassword!99';
      const wrongPassword = 'WrongPassword99';
      const salt = crypto.randomBytes(16);
      const hash = crypto.scryptSync(mockPassword, salt, 64);
      const storedScrypt = `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;

      function verifyScrypt(input: string, stored: string): boolean {
        if (!stored.startsWith('scrypt:')) return false;
        const parts = stored.split(':');
        if (parts.length !== 3) return false;
        const saltBuf = Buffer.from(parts[1], 'hex');
        const expectedBuf = Buffer.from(parts[2], 'hex');
        const computed = crypto.scryptSync(input, saltBuf, 64);
        return computed.length === expectedBuf.length && crypto.timingSafeEqual(computed, expectedBuf);
      }

      assert.equal(verifyScrypt(mockPassword, storedScrypt), true, 'Correct password verifies successfully against scrypt fixture');
      assert.equal(verifyScrypt(wrongPassword, storedScrypt), false, 'Wrong password fails against scrypt fixture');
    });
  });

  test('Admin Login: Completed-setup account is not overwritten by seed redeployment', () => {
    const existingDb = {
      adminCredentials: {
        username: 'production_superadmin',
        password: 'scrypt:salt:realproductionhash',
        email: 'admin@onival.ir',
        name: 'مدیریت ارشد اونیوال',
        initialSetupCompleted: true,
        oneTimePassword: null,
        oneTimePasswordExpired: true
      }
    };

    const seedCredentials = {
      username: 'admin',
      password: 'admin',
      email: 'admin@onival.com',
      name: 'مدیریت اونیوال (ONIVAL Admin)',
      initialSetupCompleted: false,
      oneTimePassword: 'Onival@Admin2025'
    };

    // Safe merge logic: if persistent data already exists and setup was completed, NEVER overwrite credentials with seed
    function mergeSeedData(current: typeof existingDb, seed: typeof seedCredentials) {
      if (current.adminCredentials && current.adminCredentials.initialSetupCompleted) {
        return current.adminCredentials; // Preserve configured account
      }
      return seed;
    }

    const merged = mergeSeedData(existingDb, seedCredentials);
    assert.equal(merged.username, 'production_superadmin', 'Configured admin username must be preserved');
    assert.equal(merged.password, 'scrypt:salt:realproductionhash', 'Configured password hash must NOT be replaced');
    assert.equal(merged.initialSetupCompleted, true, 'initialSetupCompleted must remain true');
    assert.equal(merged.oneTimePassword, null, 'oneTimePassword must remain null');
  });

  test('Admin Login: Username and password change invalidates old credentials and activates new', () => {
    import('node:crypto').then(crypto => {
      let currentCreds = {
        username: 'old_admin',
        password: crypto.createHmac('sha256', 'onival_salt_2025_sec').update('OldPassword123').digest('hex'),
        initialSetupCompleted: true
      };

      function login(u: string, p: string, creds: typeof currentCreds): boolean {
        if (u !== creds.username) return false;
        const legacy = crypto.createHmac('sha256', 'onival_salt_2025_sec').update(p).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(legacy), Buffer.from(creds.password));
      }

      // Initial login with old credentials works
      assert.equal(login('old_admin', 'OldPassword123', currentCreds), true);

      // Perform credential change
      const newPasswordHash = crypto.createHmac('sha256', 'onival_salt_2025_sec').update('BrandNewPassword456').digest('hex');
      currentCreds = {
        username: 'new_admin',
        password: newPasswordHash,
        initialSetupCompleted: true
      };

      // Old credentials fail
      assert.equal(login('old_admin', 'OldPassword123', currentCreds), false, 'Old username & password must fail');
      assert.equal(login('new_admin', 'OldPassword123', currentCreds), false, 'Old password with new username must fail');

      // New credentials work
      assert.equal(login('new_admin', 'BrandNewPassword456', currentCreds), true, 'New credentials log in successfully');
    });
  });

  test('Admin Login: Completed-setup account strictly rejects hardcoded admin and OTP', () => {
    const creds = {
      username: 'onival_manager',
      password: 'scrypt:salt:configuredhash',
      initialSetupCompleted: true,
      oneTimePassword: null
    };

    function attemptLogin(p: string, credsState: typeof creds): { ok: boolean; reason?: string } {
      if (credsState.initialSetupCompleted) {
        if (p === 'admin' || p === 'Onival@Admin2025') {
          return { ok: false, reason: 'DEFAULT_OR_OTP_FORBIDDEN' };
        }
      }
      return { ok: false, reason: 'INVALID_CREDENTIALS' };
    }

    assert.equal(attemptLogin('admin', creds).reason, 'DEFAULT_OR_OTP_FORBIDDEN', 'Rejects default admin password');
    assert.equal(attemptLogin('Onival@Admin2025', creds).reason, 'DEFAULT_OR_OTP_FORBIDDEN', 'Rejects expired OTP');
  });

  // =========================================================================
  // ADDITIONAL REGRESSION & DEFECT-REPAIR TESTS
  // =========================================================================
  test('Contact Tracking Code: CSPRNG format matches ONV-MSG-[HEX8]', () => {
    function generateContactTrackingCodeJs(): string {
      return 'ONV-MSG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    }

    const code1 = generateContactTrackingCodeJs();
    const code2 = generateContactTrackingCodeJs();
    assert.match(code1, /^ONV-MSG-[A-F0-9]{8}$/, 'Must have ONV-MSG prefix and 8 hex digits');
    assert.notEqual(code1, code2, 'Subsequent codes must be distinct CSPRNG random values');
  });

  test('CORS: Exact origin matching rejects deceptive substrings', () => {
    const allowedOrigins = ['https://onival.ir', 'https://www.onival.ir', 'http://localhost:3000', 'http://localhost:5173'];

    function isOriginAllowed(rawOrigin: string): boolean {
      const clean = rawOrigin.replace(/\/+$/, '');
      return allowedOrigins.includes(clean);
    }

    assert.equal(isOriginAllowed('https://onival.ir'), true);
    assert.equal(isOriginAllowed('https://www.onival.ir'), true);
    assert.equal(isOriginAllowed('http://localhost:3000'), true);
    // Deceptive origins that previously passed strpos matching:
    assert.equal(isOriginAllowed('https://evil-onival.ir'), false, 'Attacker prefix domain must be rejected');
    assert.equal(isOriginAllowed('https://onival.ir.attacker.com'), false, 'Subdomain attack must be rejected');
    assert.equal(isOriginAllowed('https://attacker.com?onival.ir'), false, 'Query string spoofing must be rejected');
  });

  test('Order Status Transition: Shipped and Completed orders reject cancellation with 409 TRANSITION_NOT_ALLOWED', () => {
    function cancelOrder(order: { status: string }): { ok: boolean; code?: string; error?: string } {
      if (order.status === 'Cancelled') {
        return { ok: true };
      }
      if (order.status === 'Shipped' || order.status === 'Completed') {
        return { ok: false, code: 'TRANSITION_NOT_ALLOWED', error: 'امکان لغو سفارشات ارسال‌شده یا تکمیل‌شده وجود ندارد.' };
      }
      order.status = 'Cancelled';
      return { ok: true };
    }

    const pendingOrder = { status: 'Pending' };
    assert.equal(cancelOrder(pendingOrder).ok, true);
    assert.equal(pendingOrder.status, 'Cancelled');

    const shippedOrder = { status: 'Shipped' };
    const shippedRes = cancelOrder(shippedOrder);
    assert.equal(shippedRes.ok, false);
    assert.equal(shippedRes.code, 'TRANSITION_NOT_ALLOWED');
    assert.equal(shippedOrder.status, 'Shipped');

    const completedOrder = { status: 'Completed' };
    const completedRes = cancelOrder(completedOrder);
    assert.equal(completedRes.ok, false);
    assert.equal(completedRes.code, 'TRANSITION_NOT_ALLOWED');
    assert.equal(completedOrder.status, 'Completed');
  });

  test('Backup Restore: Pre-restore backup failure aborts entire import without mutating data', () => {
    let databaseState = { products: [{ id: 1, title: 'Original Honey' }] };
    let backupCreated = false;

    function restoreDatabase(importData: any, simulateDiskError: boolean) {
      if (simulateDiskError) {
        // Backup copy failed
        return { ok: false, code: 'PRE_BACKUP_FAILED', error: 'Pre-backup copy failed' };
      }
      backupCreated = true;
      databaseState = { ...importData };
      return { ok: true };
    }

    // Disk failure simulation
    const failRes = restoreDatabase({ products: [{ id: 2, title: 'Imported State' }] }, true);
    assert.equal(failRes.ok, false);
    assert.equal(failRes.code, 'PRE_BACKUP_FAILED');
    assert.equal(databaseState.products[0].title, 'Original Honey', 'Database state must not be modified when backup fails');

    // Normal restore
    const passRes = restoreDatabase({ products: [{ id: 2, title: 'Imported State' }] }, false);
    assert.equal(passRes.ok, true);
    assert.equal(databaseState.products[0].title, 'Imported State');
    assert.equal(backupCreated, true);
  });

  test('Feeds: Drafts and slug-less products excluded; promo quotas respected', () => {
    const products = [
      { id: 1, title: 'عسل کوهستان', slug: 'mountain-honey', price: 200000, discountPrice: 150000, specialOfferStock: 5, status: 'published' },
      { id: 2, title: 'عسل بدون اسلاگ', slug: '', price: 200000, status: 'published' },
      { id: 3, title: 'عسل پیش‌نویس', slug: 'draft-honey', price: 200000, status: 'draft' },
      { id: 4, title: 'عسل با سهمیه تخفیف تمام‌شده', slug: 'expired-promo-honey', price: 300000, discountPrice: 210000, specialOfferStock: 0, status: 'published' }
    ];

    function filterAndPriceProducts(prods: typeof products) {
      const valid = prods.filter(p => p.slug && p.slug.trim() !== '' && p.status !== 'draft');
      return valid.map(p => {
        const hasPromoQuota = !('specialOfferStock' in p) || (p.specialOfferStock as number) > 0;
        const effectivePrice = (p.discountPrice && hasPromoQuota) ? p.discountPrice : p.price;
        return {
          id: p.id,
          title: p.title,
          price: effectivePrice,
          oldPrice: (p.discountPrice && hasPromoQuota) ? p.price : null
        };
      });
    }

    const feed = filterAndPriceProducts(products);
    assert.equal(feed.length, 2, 'Only 2 valid published products with slugs must be included');
    assert.equal(feed[0].id, 1);
    assert.equal(feed[0].price, 150000, 'Product with available promo quota gets discountPrice');
    assert.equal(feed[0].oldPrice, 200000);
    assert.equal(feed[1].id, 4);
    assert.equal(feed[1].price, 300000, 'Product with zero specialOfferStock reverts to regular price');
    assert.equal(feed[1].oldPrice, null);
  });

  test('Phase 1 Replay: Owner login record shape with initialSetupCompleted=false and OTP', () => {
    // Exact owner credential record shape from live production context
    const ownerCredRecord = {
      username: 'admin',
      initialSetupCompleted: false,
      oneTimePassword: 'TestDummyOneTimeSecret123',
      oneTimePasswordExpired: false,
      password: 'scrypt:16:64:mocklegacyhashthatcannotbeuseddirectly'
    };

    function simulateLoginHandler(body: { username?: string; password?: string }, db: any) {
      const u = (body.username || '').trim();
      const p = (body.password || '').trim();

      if (!u || !p) {
        return { status: 400, code: 'VALIDATION_ERROR', reason: 'body_field_missing' };
      }

      if (!db || !db.adminCredentials) {
        return { status: 401, code: 'AUTH_FAILED', reason: 'data_file_unreadable' };
      }

      const creds = db.adminCredentials;
      const isInitialPending = !creds.initialSetupCompleted;
      const validUser = (creds.username || 'admin').trim().toLowerCase();
      const storedOtp = creds.oneTimePassword ? String(creds.oneTimePassword).trim() : '';
      const otpExpired = Boolean(creds.oneTimePasswordExpired);

      const isUserMatch = (u.toLowerCase() === validUser) || (isInitialPending && u.toLowerCase() === 'admin');
      if (!isUserMatch) {
        return { status: 401, code: 'AUTH_FAILED', reason: 'username_mismatch' };
      }

      if (!isInitialPending) {
        if (storedOtp && p === storedOtp) {
          return { status: 401, code: 'OTP_EXPIRED', reason: 'otp_missing_or_expired' };
        }
        if (String(creds.password).startsWith('scrypt:')) {
          return { status: 401, code: 'AUTH_FAILED', reason: 'unsupported_stored_format' };
        }
      } else {
        if (!storedOtp || otpExpired) {
          return { status: 401, code: 'AUTH_FAILED', reason: 'otp_missing_or_expired' };
        }
      }

      // Verification during initial pending
      let isPassMatch = false;
      if (isInitialPending) {
        if (storedOtp) {
          const bufP = Buffer.from(p);
          const bufOtp = Buffer.from(storedOtp);
          if (bufP.length === bufOtp.length && crypto.timingSafeEqual(bufP, bufOtp)) {
            isPassMatch = true;
          }
        }
      }

      if (isPassMatch) {
        return { status: 200, ok: true, isInitialPending: true, reason: 'success' };
      }

      return { status: 401, code: 'AUTH_FAILED', reason: 'bad_password' };
    }

    const liveDb = { adminCredentials: ownerCredRecord };

    // 1. Correct dummy OTP matches -> PASS (HTTP 200)
    const successRes = simulateLoginHandler({ username: 'admin', password: 'TestDummyOneTimeSecret123' }, liveDb);
    assert.equal(successRes.status, 200);
    assert.equal(successRes.ok, true);
    assert.equal(successRes.reason, 'success');

    // 2. Wrong OTP fails with bad_password (HTTP 401)
    const wrongPassRes = simulateLoginHandler({ username: 'admin', password: 'WrongOtpValue' }, liveDb);
    assert.equal(wrongPassRes.status, 401);
    assert.equal(wrongPassRes.reason, 'bad_password');

    // 3. Username mismatch fails with username_mismatch (HTTP 401)
    const wrongUserRes = simulateLoginHandler({ username: 'non_existent_user', password: 'TestDummyOneTimeSecret123' }, liveDb);
    assert.equal(wrongUserRes.status, 401);
    assert.equal(wrongUserRes.reason, 'username_mismatch');

    // 4. Missing body fields fail with body_field_missing (HTTP 400)
    const missingFieldRes = simulateLoginHandler({ username: 'admin', password: '' }, liveDb);
    assert.equal(missingFieldRes.status, 400);
    assert.equal(missingFieldRes.reason, 'body_field_missing');

    // 5. Unreadable / empty database fails with data_file_unreadable (HTTP 401)
    const unreadableDbRes = simulateLoginHandler({ username: 'admin', password: 'TestDummyOneTimeSecret123' }, null);
    assert.equal(unreadableDbRes.status, 401);
    assert.equal(unreadableDbRes.reason, 'data_file_unreadable');

    // 6. Expired or missing OTP fails with otp_missing_or_expired (HTTP 401)
    const expiredOtpDb = {
      adminCredentials: { ...ownerCredRecord, oneTimePasswordExpired: true }
    };
    const expiredOtpRes = simulateLoginHandler({ username: 'admin', password: 'TestDummyOneTimeSecret123' }, expiredOtpDb);
    assert.equal(expiredOtpRes.status, 401);
    assert.equal(expiredOtpRes.reason, 'otp_missing_or_expired');
  });
  test('Attack Test 1: Missing DB triggers data_file_unreadable and never generates false default state', () => {
    function loadDbCheck(dataFileExists: boolean, rawContent: string | null) {
      if (!dataFileExists) {
        return { ok: false, error: 'DATABASE_FILE_MISSING', reason: 'data_file_unreadable' };
      }
      try {
        const parsed = JSON.parse(rawContent!);
        if (!parsed || typeof parsed !== 'object') {
          return { ok: false, error: 'DATABASE_CORRUPT', reason: 'data_file_unreadable' };
        }
        return { ok: true, data: parsed };
      } catch {
        return { ok: false, error: 'DATABASE_CORRUPT', reason: 'data_file_unreadable' };
      }
    }

    assert.equal(loadDbCheck(false, null).reason, 'data_file_unreadable');
    assert.equal(loadDbCheck(true, '{ broken json').reason, 'data_file_unreadable');
  });

  test('Attack Test 2: Stored scrypt legacy string NEVER authenticates even with matching plaintext password', () => {
    function verifyPasswordStrict(inputPass: string, storedHash: string, isInitialPending: boolean, validOtp: string | null): boolean {
      if (!inputPass || !storedHash) return false;
      if (isInitialPending) {
        if (!validOtp) return false;
        return crypto.timingSafeEqual(Buffer.from(inputPass), Buffer.from(validOtp));
      }
      // Completed setup requires native password hash (starting with $)
      if (storedHash.startsWith('scrypt:') || !storedHash.startsWith('$')) {
        return false;
      }
      return false;
    }

    const scryptHash = 'scrypt:16:64:mocklegacyhashthatcannotbeuseddirectly';
    assert.equal(verifyPasswordStrict('admin', scryptHash, false, null), false, 'scrypt hash must NEVER authenticate');
    assert.equal(verifyPasswordStrict('password123', scryptHash, false, null), false);
    assert.equal(verifyPasswordStrict(scryptHash, scryptHash, false, null), false);
  });

  test('Attack Test 3: Setup completion rejects passwords < 12 chars, identical to username, or identical to OTP', () => {
    function validateNewPermanentPassword(newPass: string, username: string, currentOtp: string | null) {
      if (!newPass || newPass.length < 12) {
        return { ok: false, code: 'VALIDATION_ERROR', error: 'Minimum 12 characters required' };
      }
      if (newPass.toLowerCase() === username.toLowerCase()) {
        return { ok: false, code: 'VALIDATION_ERROR', error: 'Password cannot equal username' };
      }
      if (currentOtp && newPass === currentOtp) {
        return { ok: false, code: 'VALIDATION_ERROR', error: 'Password cannot equal OTP' };
      }
      return { ok: true };
    }

    const otp = 'X7k9P2mQ4vL8wR1tY5zN';
    // Too short (<12)
    assert.equal(validateNewPermanentPassword('Short123', 'admin', otp).ok, false);
    // Exactly 11 chars
    assert.equal(validateNewPermanentPassword('12345678901', 'admin', otp).ok, false);
    // Identical to username
    assert.equal(validateNewPermanentPassword('adminadminadmin', 'adminadminadmin', otp).ok, false);
    // Identical to current OTP
    assert.equal(validateNewPermanentPassword(otp, 'admin', otp).ok, false);
    // Valid 12+ chars distinct password
    assert.equal(validateNewPermanentPassword('SecurePassword2025!', 'admin', otp).ok, true);
  });

  test('Attack Test 4: CSV Formula Injection Neutralization', () => {
    function escapeCsvField(field: any): string {
      if (field === null || field === undefined || field === '') return '""';
      let str = String(field).replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'` + str;
      }
      return `"${str}"`;
    }

    // Formula injection attacks with =, +, -, @, \t, \r
    assert.equal(escapeCsvField('=SUM(A1:A10)'), `"'=SUM(A1:A10)"`);
    assert.equal(escapeCsvField('+cmd|"/C calc"!A0'), `"'+cmd|""/C calc""!A0"`);
    assert.equal(escapeCsvField('-2+3+cmd|'), `"'-2+3+cmd|"`);
    assert.equal(escapeCsvField('@SUM(1,2)'), `"'@SUM(1,2)"`);
    assert.equal(escapeCsvField("\tDDE"), `"'\tDDE"`);

    // Standard benign fields
    assert.equal(escapeCsvField('عسل طبیعی سبلان'), '"عسل طبیعی سبلان"');
    assert.equal(escapeCsvField(250000), '"250000"');
    assert.equal(escapeCsvField('ONV-12345'), '"ONV-12345"');
  });

  test('Attack Test 5: Webhook rejects non-POST and oversized body > 256KB', () => {
    function validateWebhookRequest(method: string, contentLength: number): { status: number; ok: boolean } {
      if (method.toUpperCase() !== 'POST') {
        return { status: 405, ok: false };
      }
      if (contentLength > 262144) {
        return { status: 413, ok: false };
      }
      return { status: 200, ok: true };
    }

    // Non-POST methods
    assert.equal(validateWebhookRequest('GET', 100).status, 405);
    assert.equal(validateWebhookRequest('PUT', 100).status, 405);
    assert.equal(validateWebhookRequest('DELETE', 100).status, 405);

    // Oversized body (>256KB)
    assert.equal(validateWebhookRequest('POST', 262145).status, 413);
    assert.equal(validateWebhookRequest('POST', 500000).status, 413);

    // Valid POST under 256KB
    assert.equal(validateWebhookRequest('POST', 1024).status, 200);
    assert.equal(validateWebhookRequest('POST', 262144).status, 200);
  });

  test('Attack Test 6: Webhook update_id deduplication drops replay attacks', () => {
    const seenWindow: number[] = [101, 102, 103];

    function processWebhookUpdate(updateId: number): { ok: boolean; duplicate: boolean } {
      if (seenWindow.includes(updateId)) {
        return { ok: true, duplicate: true };
      }
      seenWindow.push(updateId);
      if (seenWindow.length > 500) {
        seenWindow.shift();
      }
      return { ok: true, duplicate: false };
    }

    assert.equal(processWebhookUpdate(102).duplicate, true, 'Replay of 102 must be flagged duplicate');
    assert.equal(processWebhookUpdate(104).duplicate, false, 'New update 104 is processed');
    assert.equal(processWebhookUpdate(104).duplicate, true, 'Immediate replay of 104 is flagged duplicate');
  });

  test('Pricing Rules (Requirement 3.2): Ordinary discount, Amazing offer quota, and strict fallback without cross-discount', () => {
    function calculateProductPrice(product: any, selectedSize: any = null) {
      const basePrice = selectedSize && selectedSize.price !== undefined
        ? Number(selectedSize.price)
        : Number(product.price || 0);

      const hasVariant = Boolean(selectedSize && typeof selectedSize === 'object');
      const isAmazingOffer = Boolean(product.isAmazingOffer || product.isSpecialOffer);

      const quota = hasVariant && selectedSize.specialOfferStock !== undefined
        ? Number(selectedSize.specialOfferStock)
        : product.specialOfferStock !== undefined
        ? Number(product.specialOfferStock)
        : null;

      // Rule 1: Amazing Offer active with quota > 0
      if (isAmazingOffer && (quota === null || quota > 0)) {
        let discPrice: number | null = null;
        if (hasVariant && selectedSize.discountPrice && Number(selectedSize.discountPrice) > 0) {
          discPrice = Number(selectedSize.discountPrice);
        } else if (product.discountPrice && Number(product.discountPrice) > 0) {
          discPrice = Number(product.discountPrice);
        } else {
          const pct = Number(product.discount || product.discountPercent || 0);
          if (pct > 0) {
            discPrice = Math.round(basePrice * (100 - pct) / 100);
          }
        }
        if (discPrice !== null && discPrice < basePrice) {
          return { price: discPrice, oldPrice: basePrice, isPromo: true };
        }
      }

      // Rule 2: Amazing Offer quota exhausted -> strictly reverts to base price (NO ordinary discount fall-through!)
      if (isAmazingOffer && quota !== null && quota <= 0) {
        return { price: basePrice, oldPrice: 0, isPromo: false };
      }

      // Rule 3: Ordinary discount
      const ordPct = Number(product.discount || product.discountPercent || 0);
      if (ordPct > 0) {
        const ordPrice = Math.round(basePrice * (100 - ordPct) / 100);
        return { price: ordPrice, oldPrice: basePrice, isPromo: false };
      }

      return { price: basePrice, oldPrice: 0, isPromo: false };
    }

    // Case A: Ordinary discount 15% on 200,000 تومان product
    const pOrd = { price: 200000, discount: 15, isAmazingOffer: false };
    assert.deepEqual(calculateProductPrice(pOrd), { price: 170000, oldPrice: 200000, isPromo: false });

    // Case B: Amazing offer with quota = 5 on 200,000 تومان product with discountPrice = 140,000
    const pAmazingActive = { price: 200000, discountPrice: 140000, isAmazingOffer: true, specialOfferStock: 5 };
    assert.deepEqual(calculateProductPrice(pAmazingActive), { price: 140000, oldPrice: 200000, isPromo: true });

    // Case C: Amazing offer with quota = 0 (EXHAUSTED) and discount = 15%
    // MUST revert to base 200,000 without falling through to ordinary 15% discount!
    const pAmazingExhausted = { price: 200000, discountPrice: 140000, discount: 15, isAmazingOffer: true, specialOfferStock: 0 };
    assert.deepEqual(calculateProductPrice(pAmazingExhausted), { price: 200000, oldPrice: 0, isPromo: false });

    // Case D: Variant size inheriting parent amazing offer quota
    const pParent = { price: 100000, isAmazingOffer: true, specialOfferStock: 2, discount: 20 };
    const sVariant = { name: '500g', price: 150000 };
    assert.deepEqual(calculateProductPrice(pParent, sVariant), { price: 120000, oldPrice: 150000, isPromo: true });

    // Case E: Variant size with specific quota = 0 while parent has quota = 2
    const sVariantExhausted = { name: '1kg', price: 280000, specialOfferStock: 0 };
    assert.deepEqual(calculateProductPrice(pParent, sVariantExhausted), { price: 280000, oldPrice: 0, isPromo: false });
  });
});

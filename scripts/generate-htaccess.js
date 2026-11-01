import fs from 'fs';
import path from 'path';

const distDir = path.join(process.cwd(), 'dist');
const publicDir = path.join(process.cwd(), 'public');

const htaccessContent = `# ==============================================================================
# ONIVAL Security & Routing Configuration for Apache / LiteSpeed / cPanel
# Generated automatically during build
# ==============================================================================

# 1. Prevent Directory Browsing
Options -Indexes

# 2. Block direct HTTP access to dotfiles
<FilesMatch "^\\.">
    Order allow,deny
    Deny from all
</FilesMatch>

# 3. Block direct HTTP access to sensitive extensions: .log, .bak, .sql, .zip, .env, .ini, .lock, etc.
<FilesMatch "\\.(log|bak|sql|zip|env.*|ini|conf|dist|sh|lock|yml|yaml|ts|tsx|map)$">
    Order allow,deny
    Deny from all
</FilesMatch>

# Block all .json files except allowed web manifest
<FilesMatch "\\.json$">
    Order allow,deny
    Deny from all
</FilesMatch>

<Files "manifest.json">
    Order allow,deny
    Allow from all
</Files>

<Files "site.webmanifest">
    Order allow,deny
    Allow from all
</Files>

# 4. Security Headers
<IfModule mod_headers.c>
    Header always set X-Frame-Options "SAMEORIGIN"
    Header set X-Content-Type-Options "nosniff"
    Header set X-XSS-Protection "1; mode=block"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
    Header set Permissions-Policy "geolocation=(), microphone=(), camera=()"
</IfModule>

# 4. API Backend & SPA URL Rewriting
<IfModule mod_rewrite.c>
    RewriteEngine On

    # Deny direct access to private server-data directory
    RewriteRule ^server-data/ - [F,L]

    # Technical SEO & feed routes
    RewriteRule ^sitemap\\.xml$ api/index.php?path=/sitemap.xml [QSA,L]
    RewriteRule ^robots\\.txt$ api/index.php?path=/robots.txt [QSA,L]
    RewriteRule ^torob/products$ api/index.php?path=/api/torob/products [QSA,L]
    RewriteRule ^emalls/products$ api/index.php?path=/api/emalls/products [QSA,L]

    # Route all /api and /api/* requests to PHP backend
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^api(?:/(.*))?$ api/index.php?path=$1 [QSA,L]

    # SPA Fallback for all other frontend routes
    RewriteRule ^index\\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . index.html [L]
</IfModule>
`;

if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, '.htaccess'), htaccessContent, 'utf-8');
  console.log('✓ Successfully generated secure .htaccess in dist/');

  // Ensure api/ directory and index.php exist in dist/
  const distApiDir = path.join(distDir, 'api');
  if (!fs.existsSync(distApiDir)) {
    fs.mkdirSync(distApiDir, { recursive: true });
  }

  // Ensure all PHP files and canonical seed in public/api exist in dist/api
  const publicApiFiles = ['index.php', 'common.php', 'webhook.php', 'bale-webhook.php', 'telegram-webhook.php', 'onival-canonical-seed.json'];
  for (const phpFile of publicApiFiles) {
    const src = path.join(publicDir, 'api', phpFile);
    const dest = path.join(distApiDir, phpFile);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`✓ Copied ${phpFile} to dist/api/${phpFile}`);
    }
  }

  // Ensure root PHP bot files for public_html exist in dist/
  const rootPhpFiles = ['bale-bot.php', 'telegram-bot.php', 'bot-config.php'];
  for (const phpFile of rootPhpFiles) {
    const src = path.join(publicDir, phpFile);
    const dest = path.join(distDir, phpFile);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`✓ Copied ${phpFile} to dist/${phpFile}`);
    }
  }

  // Ensure server-data directory and protective .htaccess exist in dist/
  const distDataDir = path.join(distDir, 'server-data');
  if (!fs.existsSync(distDataDir)) {
    fs.mkdirSync(distDataDir, { recursive: true });
  }
  fs.writeFileSync(path.join(distDataDir, '.htaccess'), "Order allow,deny\nDeny from all\n", 'utf-8');
  console.log('✓ Protected server-data directory prepared in dist/');

  // Copy test suite to dist/tests
  const distTestsDir = path.join(distDir, 'tests');
  if (!fs.existsSync(distTestsDir)) {
    fs.mkdirSync(distTestsDir, { recursive: true });
  }
  const testFileSrc = path.join(process.cwd(), 'tests', 'test_onival_suite.php');
  if (fs.existsSync(testFileSrc)) {
    fs.copyFileSync(testFileSrc, path.join(distTestsDir, 'test_onival_suite.php'));
    console.log('✓ Copied test suite to dist/tests/test_onival_suite.php');
  }
}

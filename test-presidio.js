const puppeteer = require('puppeteer');
const { createClient } = require('@libsql/client');

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

async function scrapePresidio() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const email = 'bayareagolfnow@gmail.com';
  const password = 'BayAreaGolf2026!';

  console.log('Step 1: Loading Presidio...');
  await page.goto('https://presidio.cps.golf/', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 4000));

  console.log('Step 2: Typing email...');
  // Use keyboard typing instead of value setting for React forms
  const emailInputs = await page.$$('input:not([type="password"]):not([type="hidden"])');
  if (emailInputs.length > 0) {
    await emailInputs[0].click();
    await emailInputs[0].type(email, { delay: 50 });
  }

  await new Promise(r => setTimeout(r, 1000));

  console.log('Step 3: Clicking NEXT...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const nextBtn = buttons.find(b => b.innerText.toUpperCase().includes('NEXT'));
    if (nextBtn) nextBtn.click();
  });

  await new Promise(r => setTimeout(r, 5000));

  // Check for password field
  let pageText = await page.evaluate(() => document.body.innerText);
  console.log('After NEXT:', pageText.includes('Password') ? 'Password screen' : 'Other screen');

  const hasPasswordField = await page.evaluate(() => {
    return document.querySelector('input[type="password"]') !== null;
  });

  if (hasPasswordField) {
    console.log('Step 4: Typing password (character by character)...');

    // Clear any existing value and type password
    const pwdInput = await page.$('input[type="password"]');
    if (pwdInput) {
      await pwdInput.click();
      await pwdInput.type(password, { delay: 50 });
    }

    await new Promise(r => setTimeout(r, 1500));

    // Also fill email field if it exists on this screen
    const emailOnPwdScreen = await page.$('input[type="email"], input[type="text"]:not([type="password"])');
    if (emailOnPwdScreen) {
      const currentVal = await page.evaluate(el => el.value, emailOnPwdScreen);
      if (!currentVal || currentVal.length === 0) {
        console.log('Email field empty on password screen, filling...');
        await emailOnPwdScreen.click();
        await emailOnPwdScreen.type(email, { delay: 50 });
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log('Step 5: Clicking SIGN IN...');

    // Try clicking the sign in button
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const signInBtn = buttons.find(b => {
        const text = b.innerText.toUpperCase().trim();
        return text === 'SIGN IN' || text === 'LOG IN' || text === 'LOGIN';
      });
      if (signInBtn) {
        signInBtn.click();
        return 'clicked button: ' + signInBtn.innerText;
      }

      // Also try submit button
      const submitBtn = buttons.find(b => b.type === 'submit');
      if (submitBtn) {
        submitBtn.click();
        return 'clicked submit: ' + submitBtn.innerText;
      }

      return 'no button found';
    });
    console.log('Sign in result:', clicked);

    // Wait for navigation or response
    await new Promise(r => setTimeout(r, 8000));

    // Take a screenshot equivalent - capture error messages
    pageText = await page.evaluate(() => document.body.innerText);

    // Look for specific error messages
    if (pageText.toLowerCase().includes('invalid password') ||
        pageText.toLowerCase().includes('incorrect password')) {
      console.log('\n❌ Invalid password!');
      console.log('The password "BayAreaGolf2026!" may be wrong.');
      console.log('Try resetting the password at: https://presidio.cps.golf/');
    } else if (pageText.toLowerCase().includes('user not found') ||
               pageText.toLowerCase().includes('no account')) {
      console.log('\n❌ Account not found!');
    } else if (pageText.includes('Course') && pageText.includes('Date')) {
      console.log('\n✓ LOGIN SUCCESSFUL!\n');

      // Parse tee times
      const lines = pageText.split('\n');
      const teeTimes = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const timeMatch = line.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const ampm = lines[i + 1]?.trim();
          if (ampm === 'P' || ampm === 'A') {
            const period = ampm === 'P' ? 'PM' : 'AM';
            const time = timeMatch[0] + period;

            for (let j = i; j < Math.min(i + 8, lines.length); j++) {
              const priceMatch = lines[j].match(/\$(\d+(?:\.\d{2})?)/);
              if (priceMatch) {
                teeTimes.push({ time, price: parseInt(priceMatch[1]) });
                break;
              }
            }
          }
        }
      }

      console.log('Found', teeTimes.length, 'tee times');
      teeTimes.slice(0, 5).forEach(tt => console.log('  ' + tt.time + ' - $' + tt.price));

      if (teeTimes.length > 0) {
        const course = await db.execute("SELECT id FROM courses WHERE slug = 'presidio-golf-course'");
        const courseId = course.rows[0]?.id;

        if (courseId) {
          const today = new Date().toISOString().split('T')[0];
          await db.execute({ sql: "DELETE FROM tee_times WHERE course_id = ? AND date = ?", args: [courseId, today] });

          let inserted = 0;
          for (const tt of teeTimes) {
            const match = tt.time.match(/(\d{1,2}):(\d{2})(AM|PM)/i);
            if (!match) continue;
            let hours = parseInt(match[1]);
            if (match[3] === 'PM' && hours !== 12) hours += 12;
            if (match[3] === 'AM' && hours === 12) hours = 0;
            const time24 = hours.toString().padStart(2, '0') + ':' + match[2];

            await db.execute({
              sql: 'INSERT OR IGNORE INTO tee_times (course_id, date, time, datetime, holes, players, price, has_cart, booking_url, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              args: [courseId, today, time24, today + ' ' + time24, 18, 4, tt.price, 0, 'https://presidio.cps.golf/', 'cpsgolf']
            });
            inserted++;
          }
          console.log('Inserted', inserted, 'tee times to database');
        }
      }
    } else if (pageText.includes('Please Enter Email')) {
      console.log('\n❌ Login failed - returned to email entry screen');
      console.log('This usually means wrong password or account issue.');
      console.log('\nPlease verify:');
      console.log('1. Email: bayareagolfnow@gmail.com');
      console.log('2. Password: BayAreaGolf2026!');
      console.log('3. Try logging in manually at: https://presidio.cps.golf/');
    } else {
      console.log('\nUnexpected state. Page content:');
      console.log(pageText.substring(0, 800));
    }
  } else {
    console.log('No password field found');
    console.log(pageText.substring(0, 500));
  }

  await browser.close();
}

scrapePresidio().catch(console.error);

// server.js - קובץ הכניסה הראשי לשרת
const express = require('express');  // ייבוא Framework Express (שרת)
const multer = require('multer');  // ייבוא Multer לטיפול בהעלאות קבצים
const cors = require('cors');  // הפעלת CORS (שיתוף משאבים בין דומיינים)
const path = require('path');  // כלי עזר לנתיבי קבצים
const fs = require('fs');  // מודול מערכת הקבצים
const session = require('express-session');  // Middleware לניהול סשן ב-Express
const { spawn } = require('child_process');  // יצירת תהליכי משנה (להרצת Python)
const bcrypt = require('bcrypt');  // ספרייה להאשינג של סיסמאות

const app = express();  // יצירת מופע אפליקציית Express
const port = 3000;  // מספר פורט לשרת HTTP

// ====== Storage (uploads) ======  // קונפיגורציית אחסון דיסק לקבצים מועלים
const storage = multer.diskStorage({  // שימוש במנוע אחסון דיסק של Multer
  destination: function (req, file, cb) {  // קביעת תיקיית יעד להעלאה
    // ודא שהתיקייה קיימת — צור 'uploads' אם חסרה
    const up = path.join(__dirname, 'uploads');  // נתיב מוחלט ל-/uploads
    if (!fs.existsSync(up)) fs.mkdirSync(up, { recursive: true });  // צור תיקייה רקורסיבית אם לא קיימת
    cb(null, up);  // העבר את תיקיית היעד ל-Multer
  },
  filename: function (req, file, cb) {  // קביעת שם הקובץ הנשמר
    cb(null, Date.now() + '-' + file.originalname);  // קידומת חותמת זמן לפני שם מקורי
  }
});
const upload = multer({ storage });  // אתחול Multer עם הגדרות האחסון

// ====== Static for processed videos ======  // שירות סרטונים מעובדים כקבצים סטטיים
app.use('/temp_results', express.static(path.join(__dirname, 'temp_results')));  // מיפוי ה-URL /temp_results לתיקייה מקומית

// ====== Middleware ======  // Middleware גלובלי לאפליקציה
app.set('view engine', 'ejs');  // הגדרת EJS כמנוע תצוגות
app.set('views', path.join(__dirname, 'views')); // וידוא נתיב התצוגות — הגדרה מפורשת של תיקיית views
app.use(express.static('public'));  // שירות משאבים סטטיים מ-/public
app.use(express.urlencoded({ extended: true }));  // פענוח גופי בקשה URL-encoded (טפסים)
app.use(express.json());  // פענוח גופי בקשה JSON
app.use(cors());  // הפעלת CORS לכל הנתיבים

app.use(session({  // קונפיגורציית ניהול סשנים
  secret: 'defect_secret_key',  // מפתח סודי לחתימת קוקיות
  resave: false,  // לא לשמור סשן אם לא השתנה
  saveUninitialized: false  // לא לשמור סשנים ריקים
}));

const USERS_FILE = path.join(__dirname, 'users.json');  // נתיב לאחסון משתמשים (JSON)
const RESULTS_FILE = path.join(__dirname, 'results.json');  // נתיב לאחסון תוצאות (JSON)

// ====== Helpers ======  // פונקציות עזר לקריאה/כתיבה של קבצי JSON
function readUsers() {  // קריאת משתמשים מקובץ users.json
  if (!fs.existsSync(USERS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(USERS_FILE)); } catch { return []; }  // פענוח JSON או חזרה לברירת מחדל []
}
function writeUsers(users) {  // כתיבת מערך משתמשים ל-users.json
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));  // כתיבת JSON בפורמט קריא
}
function readResults() {  // קריאת תוצאות מ-results.json
  if (!fs.existsSync(RESULTS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(RESULTS_FILE)); } catch { return []; }  // פענוח JSON או חזרה לברירת מחדל
}
function writeResults(results) {  // כתיבת מערך תוצאות ל-results.json
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));  // כתיבת JSON בפורמט קריא
}
function isHashed(pw) {  // בדיקה אם מחרוזת סיסמה נראית כמו האש של bcrypt
  return typeof pw === 'string' && pw.startsWith('$2b$');  // האשים של bcrypt מתחילים ב-$2b$
}

// Simple middleware to ensure login - Protect routes: redirect to /login if not authenticated
function requireLogin(req, res, next) {  // Middleware שומר־אימות
  if (!req.session.username) return res.redirect('/login');  // אם אין משתמש בסשן — להפנות
  next();  // המשך למטפל הבא
}

// -------------------- AUTH ----------------------  // מסלולי אימות
app.get('/login', (req, res) => {  // הצגת דף התחברות
  res.render('login', { error: null });  // העברת שגיאה null כברירת מחדל
});

app.post('/login', async (req, res) => {  // טיפול בשליחת טופס התחברות
  const { username, password } = req.body;  // שליפת פרטי הזדהות מהבקשה
  const users = readUsers();  // טעינת משתמשים מהאחסון

  const user = users.find(u => u.username === username);  // איתור משתמש לפי שם משתמש
  if (!user) {
    return res.status(401).render('login', { error: '❌ User not found.' });  // הצגת שגיאה
  }

  let ok = false;  // דגל אם הסיסמה תואמת
  if (isHashed(user.password)) {  // אם הסיסמה שמורה כהאש
    ok = await bcrypt.compare(password, user.password);  // השוואת טקסט־גלוי להאש
  } else {
    // Backward compatibility for old plaintext passwords - Support migrating old plaintext passwords
    if (user.password === password) {  // אם הטקסט־גלוי תואם
      ok = true;
      try {
        user.password = await bcrypt.hash(password, 10);  // שדרוג לסיסמה מוצפנת bcrypt
        writeUsers(users);  // שמירת users.json המעודכן
      } catch {}
    }
  }

  if (!ok) {  // אם בדיקת הסיסמה נכשלה
    return res.status(401).render('login', { error: '❌ Password mismatch or incorrect.' });  // הצגת שגיאה
  }

  req.session.username = user.username;  // שמירת שם משתמש בסשן
  req.session.role = user.role;  // שמירת תפקיד בסשן
  req.session.factory_id = user.factory_id || user.factoryID || null;  // תמיכה בשני שמות השדות האפשריים של factory_id

  user.last_login = new Date().toISOString();  // עדכון חותמת זמן התחברות אחרונה
  writeUsers(users);  // שמירת המשתמשים עם last_login מעודכן

  res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/');  // הפניה לפי תפקיד
});

app.get('/register', (req, res) => {  // הצגת דף הרשמה
  res.render('register', { error: null });  // ללא שגיאה כברירת מחדל
});

app.post('/register', async (req, res) => {  // טיפול בשליחת טופס הרשמה
  const { factoryID, email, faxNumber, username, password } = req.body;  // שליפת שדות
  const users = readUsers();  // טעינת משתמשים קיימים

  if (users.some(u => u.username === username)) {  // בדיקת ייחודיות שם המשתמש
    return res.render('register', { error: '❌ Username already exists.' });  // הצגת שגיאה
  }

  const hashedPassword = await bcrypt.hash(password, 10);  // האשת הסיסמה שסופקה

  users.push({  // הוספת רשומת משתמש חדשה
    factory_id: factoryID ?? null,   // שמירת השדה התקין — נרמול factory_id
    factoryID,                        // שמירת המפתח הישן אם צריך — תמיכת Legacy
    email,  // כתובת אימייל
    faxNumber,  // מספר פקס (אופציונלי)
    username,  // שם משתמש (התחברות)
    password: hashedPassword,         // מוצפן — שמירת סיסמה מוצפנת
    role: "user",  // תפקיד ברירת מחדל 'user'
    last_login: null  // ייקבע בהתחברות הראשונה
  });

  writeUsers(users);  // שמירת רשימת המשתמשים לקובץ
  res.redirect('/login');  // הפניה לדף התחברות
});

// -------------------- USER INTERFACE ----------------------  // דפי ממשק למשתמש
app.get('/', (req, res) => {  // נתיב השורש
  if (!req.session.username) return res.redirect('/login');  // דורש אימות
  res.render('index', { req });  // הצגת תבנית index; העברת req להקשר
});

app.get('/user/dashboard', requireLogin, (req, res) => {  // תצוגת לוח משתמש (מוגן)
  const username = req.session.username;  // שם המשתמש הנוכחי
  const factory_id = req.session.factory_id;  // מזהה המפעל של המשתמש
  const counts = req.session.yoloResults?.counts || {  // ספירות YOLO האחרונות מהסשן או ברירת מחדל
    pea_ok: 0,
    pea_defect: 0,
    tomato_ok: 0,
    tomato_defect: 0
  };
  const videoPath = req.session.yoloResults?.videoPath || '';  // נתיב הווידאו המעובד (אם קיים)

  res.render('user-dashboard', { username, factory_id, counts, videoPath });  // הצגת הדשבורד עם הנתונים
});

// -------------------- YOLO UPLOAD ----------------------  // נתיב העלאה שמפעיל עיבוד YOLO ב-Python
app.post('/upload', upload.single('video'), (req, res) => {  // טיפול בהעלאת קובץ וידאו יחיד
  console.log("📥 Video received");  // רישום קבלה בלוג

  const videoPath = req.file.path;  // נתיב יחסי לקובץ שהועלה
  const fullPath = path.resolve(videoPath);  // נתיב מוחלט עבור תהליך ה-Python
  const outputVideoName = 'processed.mp4';  // שם קובץ פלט רצוי מ-Python

  // Original video name to show in results - Keep original filename for display
  const originalVideoName = req.file.originalname || path.basename(videoPath);  // נפילה לשם בסיסי במקרה הצורך

  const python = spawn(  // הרצת תהליך Python ל-main.py
    'C:\\Users\\Basil\\AppData\\Local\\Programs\\Python\\Python310\\python.exe',  // נתיב מוחלט למפרש Python (Windows)
    ['C:\\Users\\Basil\\OneDrive\\Desktop\\moha\\main.py', fullPath, outputVideoName]  // סקריפט + ארגומנטים: נתיב קלט, שם פלט
  );

  let result = '';  // באפר לצבירת stdout מ-Python
  python.stdout.on('data', (data) => { result += data.toString(); });  // הוספת מקטעי stdout
  python.stderr.on('data', (data) => { console.error(`stderr: ${data}`); });  // רישום stderr של Python

  python.on('close', (code) => {  // בעת סיום תהליך Python
    console.log(`YOLO exited with code ${code}`);  // רישום קוד יציאה
    try {
      const jsonResult = JSON.parse(result);  // פענוח פלט JSON מ-Python

      // session for user dashboard - Save latest results in session for dashboard view
      req.session.yoloResults = {
        counts: jsonResult.counts,  // ספירות לפי מחלקה מ-Python
        videoPath: jsonResult.video // לדוגמה "/temp_results/processed_final.mp4" — כתובת הווידאו המעובד
      };

      // Append to admin/user results log - Persist run summary to results.json
      const results = readResults();  // טעינת מערך תוצאות קיים
      results.push({  // הוספת רשומת תוצאה חדשה
        id: Date.now(),  // מזהה ייחודי מבוסס חותמת זמן
        createdAt: new Date().toISOString(),  // חותמת זמן בפורמט ISO
        username: req.session.username || null,  // מי העלה/הריץ
        factory_id: req.session.factory_id || null,  // הקשר מפעל
        video: jsonResult.video,            // לדוגמה "/temp_results/processed_final.mp4" — נתיב הווידאו המעובד
        video_name: originalVideoName,      // 👈 חשוב לתצוגה — שמירת השם המקורי ל-UI
        counts: jsonResult.counts  // אובייקט ספירות לפי מחלקה
      });
      writeResults(results);  // שמירת התוצאות חזרה לקובץ

      res.redirect('/user/dashboard');  // הפניית המשתמש לדשבורד לצפייה בתוצאות
    } catch (e) {
      console.error("❌ Failed to parse result:", result, e);  // רישום שגיאת פענוח והפלט הגולמי
      res.status(500).send('Failed to parse YOLO output');  // החזרת 500 במקרה JSON לא תקין
    }
  });
});

// -------------------- ADMIN ----------------------  // נתיבי אדמין בלבד
app.use('/admin', (req, res, next) => {  // Middleware שער לאדמין
  if (req.session.role !== 'admin') return res.status(403).send("Access denied.");  // חסימת משתמשים שאינם אדמין
  next();  // המשך למשתמשי אדמין
});

app.get('/admin/dashboard', (req, res) => {  // הצגת דשבורד אדמין
  const username = req.session.username;  // שם האדמין הנוכחי
  const users = readUsers();  // טעינת רשימת משתמשים
  users.forEach(user => { if (!user.faxNumber) user.faxNumber = "—"; });  // נרמול ערכי פקס ריקים
  res.render('admin-dashboard', { username, users });  // הצגת תצוגת אדמין עם נתונים
});

app.get('/admin/settings', (req, res) => {  // הצגת דף הגדרות אדמין
  const username = req.session.username;  // שם האדמין לכותרת
  const users = readUsers();  // טעינת רשימת משתמשים מחדש
  res.render('settings', { username, users });  // הצגת תצוגת הגדרות
});

app.get('/admin/results', (req, res) => {  // הצגת רשימת תוצאות לאדמין
  const username = req.session.username;  // שם האדמין
  const results = readResults();  // טעינת כל התוצאות
  res.render('admin-results', { username, results });  // הצגת עמוד תוצאות אדמין
});

app.post('/admin/change-role', (req, res) => {  // שינוי התפקיד של משתמש
  const { username, role } = req.body;  // שליפת שם המשתמש היעד והתפקיד החדש
  const users = readUsers();  // טעינת משתמשים
  users.forEach(u => {
    if (u.username === username) u.role = role;  // עדכון תפקיד אם שם המשתמש תואם
  });
  writeUsers(users);  // שמירת השינויים
  res.redirect('/admin/settings');  // חזרה להגדרות
});

app.post('/admin/delete-user', (req, res) => {  // מחיקת משתמש
  const { username } = req.body;  // שם משתמש למחיקה
  let users = readUsers();  // טעינת משתמשים נוכחיים
  users = users.filter(u => u.username !== username);  // הסרת המשתמש היעד
  writeUsers(users);  // שמירת הרשימה המעודכנת
  res.redirect('/admin/settings');  // חזרה לעמוד ההגדרות
});

app.post('/admin/change-user-password', async (req, res) => {  // איפוס סיסמת משתמש ע״י אדמין
  const { username, newPassword } = req.body;  // משתמש יעד + סיסמה חדשה

  try {
    const users = readUsers();  // טעינת קובץ המשתמשים
    const user = users.find(u => u.username === username);  // איתור המשתמש
    if (!user) {
      return res.send('❌ User not found.');  // יציאה מוקדמת אם לא נמצא
    }

    user.password = await bcrypt.hash(newPassword, 10);  // האשת הסיסמה והחלפתה
    writeUsers(users);  // שימור המשתמשים
    res.redirect('/admin/settings');  // חזרה להגדרות
  } catch (error) {
    console.error(error);  // רישום שגיאה
    res.send('❌ Error updating password.');  // תשובת שגיאה כללית
  }
});

app.get('/admin/export-users', (req, res) => {  // הורדת users.json
  if (!fs.existsSync(USERS_FILE)) {  // אם הקובץ חסר
    return res.status(404).send('No users file.');  // תגובת 404
  }
  const users = fs.readFileSync(USERS_FILE);  // קריאת תוכן הקובץ הגולמי
  res.setHeader('Content-Disposition', 'attachment; filename=users.json');  // כפיית שם קובץ להורדה
  res.setHeader('Content-Type', 'application/json');  // כותרת סוג תוכן
  res.send(users);  // שליחת תוכן הקובץ
});

// -------------------- USER RESULTS ----------------------  // עמודי תוצאות למשתמש
// User results page - Renders list of results for current user/factory
app.get('/user/results', requireLogin, (req, res) => {  // נתיב מוגן
  const username = req.session.username;  // משתמש נוכחי
  const role = req.session.role || 'user';  // ברירת מחדל לתפקיד
  const factory_id = req.session.factory_id || null;  // הקשר מפעל

  const raw = readResults();  // טעינת כל רשומות התוצאות

  // Filter results for current user (or same factory) - Scope results
  const mine = raw.filter(r =>
    r.username === username || (factory_id && r.factory_id === factory_id)  // התאמה לפי שם משתמש או מפעל
  );

  // Prepare shape for user-results.ejs - Map raw data to view model
  const results = mine.map(r => {
    const counts = r.counts || {};  // אובייקט ספירות לפי מחלקה
    const entries = Object.entries(counts);  // זוגות מפתח-ערך
    const total = entries.reduce((s, [, v]) => s + (parseInt(v) || 0), 0);  // סכימת כל הספירות
    const defected = entries.reduce((s, [k, v]) => s + (/defect/i.test(k) ? (parseInt(v) || 0) : 0), 0);  // סכימת *_defect בלבד
    return {  // רשומת תצוגה
      id: r.id,  // מזהה
      video_name: r.video_name || 'video',  // שם לתצוגה
      created_at: r.createdAt || r.created_at || new Date().toISOString(),  // נפילה לערך זמן ברירת מחדל
      total_count: total,  // סה״כ פריטים
      defected_count: defected,  // פריטים פגומים
      class_counts: counts,  // פירוט לפי מחלקה
      video_id: r.video || null   // שימוש כקישור לסרטון המעובד — URL לסעיף 'Video'
    };
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));  // מיון מהחדש לישן

  const user = { name: username, is_admin: role === 'admin' };  // אובייקט משתמש מינימלי לתבנית
  res.render('user-results', { user, results });  // הצגת תצוגת התוצאות
});

// Optional detail page per result - Return raw JSON for a specific result
app.get('/user/results/:id', requireLogin, (req, res) => {  // נתיב מוגן עם פרמטר :id
  const all = readResults();  // טעינת כל התוצאות
  const row = all.find(r => String(r.id) === String(req.params.id));  // איתור לפי מזהה
  if (!row) return res.status(404).send('Result not found');  // 404 אם לא נמצא
  // Temporarily return JSON; if you want an EJS page, tell me to create it - Placeholder response
  res.json(row);  // שליחת הרשומה כ-JSON
});

// -------------------- LOGOUT ----------------------  // יציאה מהסשן
app.get('/logout', (req, res) => {  // ביטול הסשן והפניה להתחברות
  req.session.destroy(() => res.redirect('/login'));  // השמדת הסשן ואז הפניה
});

// -------------------- START SERVER ----------------------  // הפעלת שרת HTTP
app.listen(port, () => {  // תחילת האזנה על הפורט המוגדר
  console.log(`🚀 GO AHEAD ON http://localhost:${port}`);  // רישום כתובת ההפעלה ביומן
});

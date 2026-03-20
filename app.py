import sqlite3
import os
from flask import Flask, render_template, g, request, session, redirect, url_for, flash
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
# Secret key is required for sessions (staying logged in)
app.secret_key = 'dev_key_for_session_management' 
DATABASE = 'database.db'

# --- DATABASE UTILITIES ---

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.execute("PRAGMA foreign_keys = ON")
        db.row_factory = sqlite3.Row  
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    """Creates the 6 core tables and seeds the 'REY' account."""
    with app.app_context():
        db = get_db()
        cursor = db.cursor()

        # 1. Users 
        cursor.execute('CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, name TEXT, otp_code TEXT, pin_hash TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
        # 2. Products
        cursor.execute('CREATE TABLE IF NOT EXISTS products (product_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT, price REAL NOT NULL, stock_status INTEGER DEFAULT 1, image_filename TEXT, description TEXT)')
        # 3. Orders
        cursor.execute('CREATE TABLE IF NOT EXISTS orders (order_id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT UNIQUE NOT NULL, user_id INTEGER, total_price REAL, status TEXT DEFAULT "Pending", created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users (user_id))')
        # 4. Order Items
        cursor.execute('CREATE TABLE IF NOT EXISTS order_items (item_id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, product_id INTEGER, quantity INTEGER, price_at_time REAL, FOREIGN KEY (order_id) REFERENCES orders (order_id), FOREIGN KEY (product_id) REFERENCES products (product_id))')
        # 5. Admin Table
        cursor.execute('CREATE TABLE IF NOT EXISTS admin (admin_id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE, password_hash TEXT NOT NULL)')
        # 6. Audit Logs
        cursor.execute('CREATE TABLE IF NOT EXISTS audit_logs (log_id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id INTEGER, action_text TEXT NOT NULL, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (admin_id) REFERENCES admin (admin_id))')

        # SEED ADMIN: Creates 'REY' account if it doesn't exist
        cursor.execute("SELECT COUNT(*) FROM admin")
        if cursor.fetchone()[0] == 0:
            hashed_pw = generate_password_hash("admin123")
            cursor.execute("INSERT INTO admin (username, email, password_hash) VALUES (?, ?, ?)", 
                           ("REY", "admin@sambast.com", hashed_pw))

        db.commit()
        print("Database initialized. Log in with REY / admin123")

# --- ROUTES ---

@app.route('/')
def home():
    return render_template('user/index.html')

# --- ADMIN LOGIN ---
@app.route('/admin', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        # Matches name="username" and name="password" in your HTML
        user_input = request.form.get('username') 
        pass_input = request.form.get('password')

        db = get_db()
        admin = db.execute('SELECT * FROM admin WHERE username = ?', (user_input,)).fetchone()

        if admin and check_password_hash(admin['password_hash'], pass_input):
            session.clear()
            session['admin_id'] = admin['admin_id']
            session['admin_user'] = admin['username']
            return redirect(url_for('admin_dashboard'))
        
        flash("Invalid Username or Password")
        
    return render_template('admin/adminlogin.html')

# --- ADMIN DASHBOARD ---
@app.route('/admin/dashboard')
def admin_dashboard():
    # Protection: Redirect to login if session is empty
    if 'admin_id' not in session:
        return redirect(url_for('admin_login'))
    return render_template('admin/analytics.html')

# --- LOGOUT ---
@app.route('/admin/logout')
def admin_logout():
    session.clear()
    return redirect(url_for('admin_login'))

# --- FORGOT PASSWORD FLOW ---

@app.route('/admin/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email')
        session['reset_email'] = email
        session['temp_otp'] = "123456" 
        print(f"DEBUG: OTP for {email} is 123456") 
        return redirect(url_for('verify_otp'))
    return render_template('admin/verifyemail.html')

@app.route('/admin/verify-otp', methods=['GET', 'POST'])
def verify_otp():
    if request.method == 'POST':
        user_otp = request.form.get('otp')
        if user_otp == session.get('temp_otp'):
            return redirect(url_for('reset_password'))
        flash("Invalid OTP")
    return render_template('admin/verifyemail.html')

@app.route('/admin/reset-password', methods=['GET', 'POST'])
def reset_password():
    if request.method == 'POST':
        new_pass = request.form.get('password')
        hashed = generate_password_hash(new_pass)
        db = get_db()
        db.execute('UPDATE admin SET password_hash = ? WHERE email = ?', 
                   (hashed, session.get('reset_email')))
        db.commit()
        flash("Password reset successful!")
        return redirect(url_for('admin_login'))
    return render_template('admin/createpass.html')

if __name__ == '__main__':
    # Initialize the DB if it doesn't exist
    if not os.path.exists(DATABASE):
        init_db()
    app.run(debug=True)
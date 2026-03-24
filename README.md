# PrintPlus

PrintPlus is a **desktop billing and order management application** designed for printing businesses.
It allows users to manage customers, create bills, and track printing orders easily.

The project is built using:

* Electron
* React
* Vite
* TypeScript

---

# App Preview


Example:

```
docs/
 ├─ dashboard.png
 ├─ orders.png
 └─ customers.png
```

Then reference them in the README:

![Dashboard](docs/dashboard.png)

![Orders](docs/orders.png)

---

# Features

* Dashboard overview
* Customer management
* Order tracking
* Billing interface
* Rate settings management
* Clean and simple UI

---

# Requirements

Before running the project install:

* Node.js (v18 or later)
* npm
* Git (optional)

Download Node.js:
https://nodejs.org

---

# Installation

### 1. Clone the repository

```bash
git clone https://github.com/alisterpriv/printplus.git
```

---

### 2. Go to the project directory

```bash
cd printplus
```

---

### 3. Install dependencies

```bash
npm install
```

---

### 4. Start the development server

```bash
npm run dev
```

After running the command you will see:

```
Local: http://localhost:5173
```

Open this link in your browser.

---

# Project Structure

```
printplus
│
├── src
│   ├── app
│   │   ├── components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Orders.tsx
│   │   │   ├── Customers.tsx
│   │   │   ├── CreateBill.tsx
│   │   │   ├── PrintInvoice.tsx
│   │   │   └── Root.tsx
│   │   │
│   │   └── routes.ts
│
├── electron.cjs
├── index.html
├── package.json
└── vite.config.ts
```

---

# Development Notes

Recent changes:

* Reports module removed
* Sample/mock data removed
* Cleaned project structure
* Ready for database integration

---

# Future Improvements

Planned upgrades for the project:

* SQLite database integration
* Excel export for reports
* Offline data storage
* Windows desktop installer

---

# Author

**Alister Dsilva**
